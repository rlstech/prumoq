# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# INSTRUÇÕES PARA O CLAUDE CODE — PrumoQ

Este arquivo orienta o Claude Code sobre como desenvolver o PrumoQ.
Leia todos os arquivos de spec antes de começar qualquer implementação.

## Estado Atual do Projeto

**Branch `neon-clerk`: banco no Supabase (plano gratuito, API REST + RLS) + Clerk (login) + Cloudflare Workers.**
O banco chegou a ir para o Neon, mas voltou ao Supabase: com o PowerSync conectado o Neon nunca dorme e sai do plano gratuito.
O app nativo foi descartado: o app de campo é só o **PWA** (Expo web, offline com PowerSync Web).
O painel admin deixou de ser Next.js: é um **SPA estático** (Vite + React Router) servido por um Worker.
Ambos estão publicados em `https://prumoq.railton.eu.org` no ambiente de TESTE (projeto Supabase `prumoq-teste`,
Clerk dev, PowerSync Development); a virada para produção ainda não aconteceu (ver memória do projeto).

```
prumoq/
  apps/mobile/       ← PWA: Expo 52 (web) + Expo Router + PowerSync Web + Clerk; Worker em worker/ (rota de mídia R2)
  apps/admin/        ← Painel admin: Vite + React 19 + React Router (SPA em /admin) + Worker em worker/ (contas no Clerk)
  packages/shared/   ← tipos TypeScript (Database) + enums + renderer do relatório de FVS
  packages/design-system/ ← tokens: "Trena" (PWA) e "Prumo Mineral" (admin); símbolos da marca
  neon/              ← baseline do schema (extraído do Supabase) + patch Clerk/PowerSync (`baseline/supabase.sql`)
  powersync/         ← configuração do PowerSync Cloud (service.yaml, sync-config.yaml)
  supabase/          ← migrations históricas (referência; o schema atual é raw/ + supabase.sql)
  references/        ← protótipos HTML (não modificar)
```

## Arquitetura

### Banco e segurança (Supabase + RLS)

Os dois apps falam com o banco pela **API REST do Supabase** (PostgREST) com `supabase-js`, a chave publicável
(header `apikey`) e o token do Clerk do template `neon` (`role: authenticated`; o Supabase aceita o Clerk via
"third-party auth"; o nome do template é histórico). **A RLS do banco é a fronteira de segurança**:
qualquer usuário logado pode chamar a API direto, então toda regra de permissão precisa estar nas policies
ou nas funções do banco (`criar_usuario`, `plataforma_criar_cliente`, `excluir_obra`...), nunca só no front.
`current_usuario_id()` mapeia o `sub` do Clerk para `usuarios.id` via `usuarios.clerk_user_id`.

O plano gratuito do Supabase pausa o projeto após 7 dias sem atividade: o Worker do PWA tem um Cron Trigger
diário (`scheduled` em `apps/mobile/worker/index.ts`) que chama `rpc/registrar_heartbeat`.
Os retries de 401 `jwt_ausente` (`lib/neon/retry-fetch.ts`, `dataApi()` nos Workers) são herança do Neon e não disparam no Supabase.

### PWA (apps/mobile)

- Root layout web: `app/_layout.web.tsx` (importa `lib/setup-rn-web.ts` PRIMEIRO — corrige o NativeWind no web).
- Login e sessão: `lib/auth/clerk.ts` (clerk-js headless), `lib/auth/sessao.tsx` (`SessaoProvider`, `useSessao`,
  `useConta`); a conta do aparelho fica em localStorage e permite abrir offline.
- Banco local: `lib/powersync.ts` (`@powersync/web`, OPFS), schema em `lib/schema.ts`, regras de sync em
  `powersync/sync-config.yaml` (Sync Streams por obra). Envio da fila: `lib/powersync-connector.ts` (Data API).
- Mídia: fotos pendentes como `data:` URL na linha local; envio por `lib/media-envio.ts`; assinatura de URLs
  pela rota `POST /api/media/presign` do Worker (`worker/index.ts`, R2 via `aws4fetch`).
- Offline: `public/sw.js` com precache do build (`scripts/build-sw.mjs` roda depois do `expo export`).
- React: o PWA usa React 18.3 (cópia em `apps/mobile/node_modules`); a raiz tem React 19 para o admin.
  `metro.config.js` resolve `react`/`react-dom` sempre a partir do app e o `tsconfig` aponta os tipos para a 18.
- **Ao adicionar uma tabela/coluna**: schema local (`lib/schema.ts`), `powersync/sync-config.yaml`, publicação
  `powersync` no Postgres e, se for escrita, o connector.

### Painel admin (apps/admin)

SPA estático em `/admin`. O Worker (`worker/index.ts`) serve `dist/` sem rodar código e só executa em
`/admin/api/*` (plano gratuito do Workers: 10 ms de CPU por requisição — por isso não há render no servidor).

- Telas em `src/app/**` (mesma organização do antigo Next: `page.tsx` + `*Client.tsx` + `actions.ts`), rotas
  declaradas em `src/router.tsx`. As `page.tsx` são funções assíncronas que buscam os dados e devolvem JSX;
  `src/lib/compat/server-component.tsx` as executa dentro do TanStack Query.
- `src/lib/compat/` imita a API do Next usada pelo código: `navigation.ts` (`useRouter`, `usePathname`,
  `useSearchParams`, `redirect`, `notFound`), `link.tsx`, `cache.ts` (`revalidatePath` → recarrega as consultas).
- `actions.ts` rodam no navegador com o token do usuário (`@/lib/supabase/server` devolve o cliente do navegador).
  `requireTenantRole`/`getAuthContext` (`src/lib/auth/context.ts`) são checagens de interface; quem autoriza é a RLS.
- O que exige segredo vai para o Worker (`src/lib/admin-api.ts` → `/admin/api/*`): criar usuário, atualizar
  nome/e-mail da conta e criar cliente no Clerk. Fotos: `src/lib/media/signed-urls.ts` usa a rota de mídia do
  Worker do PWA com `partial: true`.
- Guarda de sessão: `src/auth/RequireSignedIn.tsx`; perfil/inspetor/suspenso nos layouts `src/app/(admin)/layout.tsx`
  e `src/app/(platform)/layout.tsx`. Inspetor não acessa o painel.
- Componentes canônicos: `src/components/ui/` (`DataTable`, `Modal`, `ConfirmDialog`, `KPICard`, `ProgressBar`,
  `StatusBadge`, `Toast`, `ToggleSwitch`...) e `src/components/layout/` (`Sidebar`, `Header`, `PageHeader`).
- Datas: o servidor do Worker roda em UTC; formatar com `timeZone: 'America/Sao_Paulo'` e usar
  `hojeEmBrasilia()` (`src/lib/dates.ts`) para "hoje".
- CSP e cache: `apps/admin/_headers` (copiado para `dist/` pelo `scripts/postbuild.mjs`).

### Print / PDF

Não há geração de PDF no servidor. Os relatórios abrem uma página de impressão e o usuário usa
"Salvar como PDF" do navegador:
- Admin: `src/app/relatorio/fvs/[fvsId]` (renderer de `@prumoq/shared`) e `src/app/relatorio/avaliacoes-empreiteiro/[id]` (iframe com a folha A4).
- PWA: `apps/mobile/app/(app)/print/[fvsId].web.tsx`.

### Shared Package

`@prumoq/shared` exporta `Database` (tipos do schema), enums (`StatusObra`, `PerfilUsuario`...) e o renderer do
relatório de FVS (`renderFvsReportBody`, `FVS_REPORT_CSS`). Validação (Zod) fica em cada app.

## Arquivos de referência (ler nesta ordem antes de implementar)

1. `SPEC.md` — Visão geral, stack, personas, hierarquia de dados, regras de negócio
2. `schema.sql` — Schema completo do banco Supabase (já copiado para `supabase/migrations/001_initial_schema.sql`)
3. `design-system.md` — Cores, tipografia, componentes, padrões visuais
4. `screens-mobile.md` — Especificação de todas as telas do app React Native
5. `screens-admin.md` — Especificação de todas as telas do painel admin
6. `sync-rules.md` — Schema PowerSync, regras de sync, upload de fotos offline
7. `references/prumoq_mobile_inspector.html` — Protótipo visual do app mobile **(REFERÊNCIA DE DESIGN)**
8. `references/fvs_admin_prumoq.html` — Protótipo visual do painel admin **(REFERÊNCIA DE DESIGN)**

## Comandos

### Pré-requisitos
```bash
# Node.js 22+; pnpm via corepack (nesta máquina `pnpm` não está no PATH: use `corepack pnpm ...`)
corepack enable
```

### Desenvolvimento
```bash
pnpm install              # instala todas as dependências do monorepo

pnpm mobile:web           # PWA no navegador (Expo)
pnpm mobile:build:web     # build do PWA (dist/ + service worker)
pnpm admin                # painel admin em http://localhost:5173/admin/ (Vite)
pnpm build:admin          # build do painel (apps/admin/dist)

pnpm typecheck            # typecheck em todos os workspaces (inclui os Workers)
pnpm --filter @prumoq/admin test   # testes unitários do admin
```

### Workers (Cloudflare)
```bash
# PWA: apps/mobile → Worker prumoq-pwa (assets + /api/media/presign)
cd apps/mobile && npx wrangler deploy        # depois de `pnpm mobile:build:web`
# Admin: apps/admin → Worker prumoq-admin (assets + /admin/api/*)
cd apps/admin && npx wrangler deploy         # depois de `pnpm build:admin`
# Segredos (nunca em arquivo): npx wrangler secret put <NOME>
# Dev local do admin com a API: npx wrangler dev --port 8788 --var CLERK_SECRET_KEY:... --var NEON_DATA_API_URL:...
```
Domínio (teste): `https://prumoq.railton.eu.org` — rota `prumoq.railton.eu.org/*` no `prumoq-pwa` e
`prumoq.railton.eu.org/admin*` no `prumoq-admin` (a mais específica vence). Mesma origem: o admin usa
`/api/media/presign` do PWA (`VITE_MEDIA_API_URL` vazio) e o `public/sw.js` do PWA não pode interceptar `/admin`.
O deploy automático (`.github/workflows/deploy.yml`) publica os dois Workers a cada push no `main`.

### Banco (Supabase)
O schema é `neon/baseline/raw/` (extraído do catálogo do Supabase) + `neon/baseline/supabase.sql` (gerado por
`node neon/baseline/build-supabase.mjs`: identidade do Clerk, policies sem `auth.uid()`, RPCs novas, `obra_id` do
PowerSync, heartbeat). Replicação do PowerSync: `neon/baseline/supabase-powersync.sql` (senha da role à parte).
Leia `neon/baseline/README.md` antes de mexer. As migrations em `supabase/migrations` são históricas; várias corrigem RLS e cálculo
de progresso (ex.: `007_fix_nc_join_inflates_progress.sql`, `010_fix_verificacoes_rls_obra_access.sql`) — área
sensível, revisar com cautela. O módulo de medições usa triggers autoritativos em `avancos_aprovados_servico`.

## Variáveis de Ambiente

Veja `.env.example`. Arquivos `.env.local` só com valores públicos; segredos nos Workers.

| Variável | Onde |
|---|---|
| `EXPO_PUBLIC_POWERSYNC_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_MEDIA_API_URL` | `apps/mobile/.env.local` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_PWA_URL`, `VITE_MEDIA_API_URL` | `apps/admin/.env.local` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_ORIGINS` | segredos do Worker `prumoq-pwa` |
| `CLERK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | segredos do Worker `prumoq-admin` |

## Prioridades de Implementação

### Fase 1 — Fundação ✅ (concluída)
1. ✅ Configurar monorepo (pnpm workspaces)
2. ✅ Criar `supabase/migrations/001_initial_schema.sql`
3. ✅ Configurar tipos TypeScript a partir do schema
4. ✅ Configurar PowerSync (schema local em `apps/mobile/lib/schema.ts`)
5. ✅ Criar Edge Function de presigned URL para Cloudflare R2
6. Pendente: executar SQL no Supabase, configurar PowerSync dashboard, configurar R2

### Fase 2 — App Mobile ✅ (concluída)
1. ✅ Expo Router setup + autenticação (grupos de rota + auth state)
2. ✅ PowerSync + SupabaseConnector (schema + connector implementados)
3. ✅ Dashboard com queries reais
4. ✅ Fluxo Obras → Ambiente → FVS → Histórico
5. ✅ Nova Verificação (a tela mais complexa)
6. ✅ Upload de fotos offline-first
7. ✅ Assinatura digital
8. ✅ NC abertas
9. ✅ PWA web com shim Supabase (powersync-web-shim.ts)

### Fase 3 — Painel Admin (em andamento)
1. ✅ Next.js setup + Supabase SSR
2. ✅ Login + middleware de autenticação
3. ✅ Dashboard com dados reais
4. ✅ CRUD Obras
5. ✅ FVS Padrão (biblioteca + editor de revisões)
6. ✅ Equipes
7. ✅ Usuários
8. ✅ Verificações (tabela + modal)
9. ✅ CRUD Empresas
10. ✅ Ambientes + FVS Planner (`obras/[id]/ambiente/[ambId]/`)
11. ✅ NC centralizada
12. Pendente: Relatórios + PDF (página existe mas funcionalidade incompleta)

## Diretrizes de Código

### TypeScript
- Strict mode habilitado
- Tipar tudo — sem `any`
- Usar tipos de `@prumoq/shared` (package compartilhado)
- Zod para validação em runtime
- Após mudar o schema, regerar `packages/shared/src/database.types.ts`

### React Native
- Expo SDK 52
- Expo Router para navegação (file-based, diretório `app/`)
- `StyleSheet.create()` ou NativeWind para estilos
- `SafeAreaView` em todas as telas
- Testar em iOS e Android

### Painel admin
- SPA estático: nada de render no servidor; dados buscados no navegador (TanStack Query)
- Nova tela: `src/app/<rota>/page.tsx` (+ `*Client.tsx`) e registrar em `src/router.tsx`
- Escritas em `actions.ts` junto à rota, rodando no navegador; o que exige segredo vai para `apps/admin/worker`
- Tailwind CSS — tokens de cor em `apps/admin/tailwind.config.ts`

### Banco de Dados
- Usar `@prumoq/shared` — client tipado com `Database`
- RLS sempre ativo — nunca `supabase.rpc()` sem verificação
- `supabase.from().select()` com joins ao invés de múltiplas queries
- No mobile: `usePowerSyncQuery()` para queries reativas
- **Embeds PostgREST exigem hint `!constraint`**: a migration 027 adicionou FKs
  compostas `(coluna, cliente_id)` ao lado das FKs simples originais. Todo embed
  (`select('*, obras(...)')`) entre pares de tabelas com duas FKs falha com
  PGRST201 ("more than one relationship") — desambiguar sempre
  (ex.: `obras!ambientes_obra_id_fkey(...)`, `usuarios!inspetor_id(...)`;
  combina com `!inner`: `fvs_planejadas!verificacoes_fvs_planejada_id_fkey!inner(...)`).

### PowerSync
- Schema local em `apps/mobile/lib/schema.ts` (15 tabelas)
- Connector (envio da fila pela API REST do Supabase) em `apps/mobile/lib/powersync-connector.ts`
- `usePowerSyncQuery()` para queries reativas
- `db.execute()` para writes offline
- `created_offline` em novos registros: usar `criadoOffline()` (`lib/powersync.ts`), 1 só quando salvo sem conexão (selo "Criada offline")
- Checar `db.currentStatus.connected` para status offline
- Ao fazer logout: `db.disconnectAndClear()` (não `disconnect()` + `clearLocal()` separados)
- Bucket definitions (YAML) configuradas no PowerSync Dashboard — ver `sync-rules.md`

### Cloudflare R2
- Upload SEMPRE via presigned URL (Edge Function em `supabase/functions/r2-presign/`)
- Chave de objeto: `fotos/{user_id}/{ano}/{mes}/{timestamp}_{filename}`
- Foto pendente de upload: `r2_key = 'pending:[local_path]'`
- URL pública via domínio customizado: `https://fotos.prumoq.com.br/{key}`
- Thumbnail gerado server-side após upload (Fase 2+)

## Regras de Negócio Críticas

- **RN-01:** Item NC → 4 campos obrigatórios + 1 foto
- **RN-02:** NC só fecha com re-inspeção conforme
- **RN-03:** Inspetor = usuário logado (não editável)
- **RN-04:** FVS versioning — `revisao_associada` captura a revisão no momento da associação
- **RN-05:** Progresso calculado automaticamente pelo trigger `update_fvs_status`
- **RN-06:** Perfis `inspetor`, `admin` e `gestor` acessam o mobile. O painel web bloqueia perfil `inspetor`.
- **RN-07:** Assinatura digital
- **RN-08:** Acesso por obra — escopo de acesso por obra, implementado via RLS e, no shim web, via `getAllowedObraIds`
- **RN-09:** App 100% funcional offline — todo write vai via PowerSync
- **RN-10:** FVS Padrão inativa

## Design

**`design-system.md` e `packages/design-system/` são a referência visual definitiva.**
São duas identidades: **Trena** no PWA (grafite + amarelo de trena, logo "Q de face") e
**Prumo Mineral** no admin (azul prumo + cal viva), que ainda não migrou. Os protótipos
HTML em `references/` continuam válidos para conteúdo e fluxos, não para cores,
tipografia ou shell.

Ao implementar qualquer tela:
1. Consulte o fluxo no HTML de referência correspondente (`prumoq_mobile_inspector.html` para mobile, `fvs_admin_prumoq.html` para web)
2. Use os tokens de `packages/design-system/` (via `apps/mobile/lib/constants.ts` no PWA) e os padrões de `design-system.md`
3. Use os componentes canônicos de cada app
4. Ícones: no PWA, sempre de `apps/mobile/lib/icons.tsx` (nunca direto de `lucide-react-native`); no admin, Lucide React. Nada de emoji
5. PWA: texto sobre o amarelo é sempre grafite (`Palette.onAccent`); não usar o amarelo como texto ou borda sobre fundo claro

Cores principais do PWA (Trena; `trenaPalette`):
- Brand / Grafite: `#1C1F22`
- Accent / Amarelo Trena: `#FFC21A`
- Canvas / Concreto: `#ECEAE6`
- OK/Conforme: `#1F7A3A`
- NOK/Não conforme: `#C8281E`
- Sync/Em andamento: `#2459A8`
- Warn/Prazo: `#B85400`

Cores principais do admin (Prumo Mineral; `apps/admin/tailwind.config.ts`):
- Brand / Azul Prumo: `#163B50`
- Accent / Cal Viva: `#D8E568`
- Canvas / Calcário: `#F4F1E8`
