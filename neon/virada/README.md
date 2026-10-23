# Virada para produção

Leva o Supabase de produção `prumoq` (`xdeyoxdtfbueuymvbsbl`) para o mesmo estado do ensaio `prumoq-teste`:
login pelo Clerk de produção, PowerSync Production, Workers apontando para a produção.
O banco não é copiado: o patch (`neon/baseline/supabase.sql`) é aplicado sobre o schema e os dados que já estão lá.

Estado conferido em 2026-10-23 (`virada.mjs conferir`): 40 tabelas, 78 policies, 89 funções (86 do app + `rls_auto_enable`
+ `pq_migracao_auth_users` + 1), 73 triggers, 4 usuários, 27 MB, nenhum slot de replicação, último login em 19/10.
Ninguém usa o app antigo (o servidor antigo responde 522), então a virada não derruba usuários.

## Segredos

Num arquivo **fora do repo**, por exemplo `C:\Users\Railton\.prumoq-prod.env` (modelo em `prod.env.example`).
Nunca colar no chat. Todos os comandos rodam com `node --env-file=C:/Users/Railton/.prumoq-prod.env ...`.

## 1. Antes (só você, nos painéis)

1. **Clerk: criar a instância de produção** (Configure → "Create production instance", clonando a dev).
   - Domínio: `prumoq.railton.eu.org`. O Clerk mostra 5 registros CNAME (`clerk.`, `accounts.`, `clkmail.`,
     `clk._domainkey.`, `clk2._domainkey.`): criar na zona `railton.eu.org` do Cloudflare com **proxy desligado**
     (nuvem cinza) e esperar o Clerk validar e emitir os certificados.
   - Senha mínima: **8** (User & authentication → Password).
   - Conferir que o Frontend API ficou `clerk.prumoq.railton.eu.org`. Se ficar outro, ajustar
     `powersync-production/service.yaml` (`jwks_uri`) e a CSP em `apps/admin/_headers`.
   - Copiar `sk_live_...` e `pk_live_...` para o arquivo de segredos.
2. **Senha da role do PowerSync:** gerar uma senha forte e colocar em `PS_DATABASE_PASSWORD` no mesmo arquivo.
3. **Cloudflare/GitHub:** ter em mãos o acesso para `wrangler secret put` (já logado nesta máquina) e para as
   variáveis do repositório no GitHub (Settings → Secrets and variables → Actions).

## 2. Banco e contas (script `virada.mjs`)

```bash
ENV=--env-file=C:/Users/Railton/.prumoq-prod.env
node $ENV neon/virada/virada.mjs conferir    # só lê; precisa dizer "schema no estado esperado"
node $ENV neon/virada/virada.mjs backup      # dados + auth.users + catálogo em BACKUP_DIR (~2 min)
node $ENV neon/virada/virada.mjs templates   # JWT templates `neon` e `powersync` no Clerk de produção
node $ENV neon/virada/virada.mjs usuarios    # usuários no Clerk prod com a mesma senha (bcrypt) → clerk-map.json
node $ENV neon/virada/virada.mjs patch       # supabase.sql + clerk_user_id de cada usuário
node $ENV neon/virada/virada.mjs auth        # Supabase passa a aceitar tokens do Clerk de produção
node $ENV neon/virada/virada.mjs powersync   # role pq_powersync (com a senha) + publicação `powersync` (30 tabelas)
node $ENV neon/virada/virada.mjs verificar   # tudo OK
```

A partir do `patch` o app antigo (login do Supabase) deixa de funcionar: as policies passam a ler o `sub` do Clerk.
Para voltar atrás, o `backup` tem o corpo de todas as funções e policies anteriores.

## 3. PowerSync Production

```bash
# PS_ADMIN_TOKEN (token da conta PowerSync) e PS_DATABASE_PASSWORD no ambiente
npx -y powersync@0.10.2 deploy --directory powersync-production --sync-config-file-path powersync/sync-config.yaml --dry-run
npx -y powersync@0.10.2 deploy --directory powersync-production --sync-config-file-path powersync/sync-config.yaml
```

Depois do deploy, conferir o slot no banco (`verificar` mostra `slots`) e o status da instância no painel.

## 4. Workers

Segredos (`wrangler secret put <NOME>` em cada app):

| Worker | Segredo | Valor de produção |
|---|---|---|
| `prumoq-pwa` | `SUPABASE_URL` | `https://xdeyoxdtfbueuymvbsbl.supabase.co` |
| `prumoq-pwa` | `SUPABASE_PUBLISHABLE_KEY` | chave publicável do projeto de produção |
| `prumoq-pwa` | `ALLOWED_ORIGINS` | `https://prumoq.railton.eu.org` (+ `http://localhost:8081,http://localhost:5173` se ainda quiser testar local) |
| `prumoq-admin` | `CLERK_SECRET_KEY` | `sk_live_...` |
| `prumoq-admin` | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | iguais aos do PWA |

R2 continua o mesmo bucket. Variáveis públicas do build (GitHub → Variables, usadas pelo `deploy.yml`):

| Variável | Valor |
|---|---|
| `EXPO_PUBLIC_POWERSYNC_URL` | `https://6ad62293423e048d1cdcfde2.powersync.journeyapps.com` |
| `EXPO_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_URL` | `https://xdeyoxdtfbueuymvbsbl.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publicável de produção |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `VITE_PWA_URL` | `https://prumoq.railton.eu.org` |

Secrets do GitHub: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) e `CLOUDFLARE_ACCOUNT_ID`.
Publicar: merge do `neon-clerk` no `main` (o `deploy.yml` builda e publica os dois Workers) ou deploy manual
com as mesmas variáveis no ambiente.

## 5. Teste

- Scripts de teste do scratchpad com `BASE=https://prumoq.railton.eu.org` (agora contra produção: apagar o que criarem).
- No celular: login com a senha de sempre, sincronizar uma obra, verificação com foto, foto visível no admin,
  ciclo offline. No admin: telas, impressão de relatório, criar usuário.
- Cron do heartbeat: no dia seguinte, `select * from sistema_heartbeat`.

## 6. Limpeza (depois de alguns dias estável)

- Dropar `pq_migrador` e `pq_migracao_auth_users()` na produção; apagar o secret `NEON_DATA_API_URL` dos Workers.
- Desligar a instância Development do PowerSync e apagar o `prumoq-teste` (ou mantê-lo como ambiente de teste).
- Trocar as chaves que apareceram no chat (Clerk dev, R2, senha do `neondb_owner`); decidir o destino do projeto Neon.
- Remover `apps/mobile/lib/supabase-connector.ts`, `supabase/functions/r2-presign`, Dockerfiles/nginx antigos.
- Backup semanal agendado (o plano gratuito do Supabase não tem backup automático): `virada.mjs backup`.
- Acompanhar o WAL nos primeiros dias (`verificar` mostra o tamanho): no teste estabilizou em ~576 MB de 1 GB.
