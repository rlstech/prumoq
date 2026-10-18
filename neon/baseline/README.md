# Baseline do schema (extraído do Supabase real)

Extraído em 2026-10-17 do projeto Supabase `xdeyoxdtfbueuymvbsbl` via catálogo
(`pg_get_functiondef`, `pg_get_constraintdef`, `pg_get_triggerdef`, `pg_policies`...).
Substitui o replay de `supabase/migrations/*` (que não reaplica do zero).

`raw/` = DDL **sem nenhum patch**, só o que o Supabase tem hoje. Os patches para
Neon/Clerk ficam em `neon/build-migrations.mjs`, não aqui.

## Ordem de aplicação

1. `01_types.sql` — 21 enums
2. `02_tables.sql` — 40 tabelas (defaults usam `extensions.uuid_generate_v4()`)
3. `03_constraints.sql` — PK, UNIQUE, CHECK (113)
4. `04_indexes.sql` — 76 índices (os `uq_*_id_cliente` são alvo das FKs compostas)
5. `05_foreign_keys.sql` — 159 FKs (precisa vir **depois** de 04)
6. `06a..06d_functions.sql` — 86 funções (views e policies dependem delas)
7. `07_views.sql` — 4 views, todas `security_invoker=true`
8. `08_triggers.sql` — 73 triggers
9. `09_rls_policies.sql` — RLS em 40 tabelas + 78 policies

Conferido contra o catálogo: tipos 21, tabelas 40, constraints 113 (40p+15u+58c),
FKs 161 (159 + 2 removidas), índices 131 (40 pk + 15 uq + 76), triggers 73,
policies 78, views 4, funções 86.

## O que NÃO é portável e precisa de patch

- **FKs para `auth.users`** (removidas do arquivo, deixadas como comentário):
  `usuarios_id_fkey` e `auditoria_plataforma_ator_id_fkey`.
- **`auth.uid()` / `auth.role()`**: usadas em ~40 funções e policies. No Neon Data API,
  `auth.user_id()` retorna `text` (id do Clerk), não `uuid`. Precisa de
  `current_usuario_id()` ou equivalente.
- **`get_clientes_resumo()` e `get_usuarios_com_obras()`**: leem `auth.users`
  (email, invited_at, last_sign_in_at). Marcadas `NEON-TODO`; precisam de outra fonte (Clerk).
- **Roles** `anon` → `anonymous`; `service_role` não existe no Neon.
- **`extensions.uuid_generate_v4()`**: no Neon usar `gen_random_uuid()` ou criar a extensão.
- **`enforce_row_cliente_id()`** testa `auth.role() = 'service_role'` para pular o guard.
- **Publication `powersync`** (37 tabelas) não está neste baseline. `supabase_realtime` está vazia.
- Fora do baseline: `rls_auto_enable` (helper de event trigger do Supabase), `uuid_generate_v4`
  (extensão), extensões `pg_stat_statements`/`supabase_vault`, schemas `auth`/`storage`, grants.

## Divergência intencional: mojibake

No Supabase, ~25 funções têm mensagens de erro com codificação dupla
(ex.: `AprovaÃ§Ã£o nÃ£o permitida`), enquanto outras estão corretas. Os arquivos aqui
têm o texto **corrigido** (`Aprovação não permitida`). Se alguma coisa do app comparar
essas mensagens por string, vai divergir; não achei evidência disso, mas não busquei.

## Build e verificação (feito em 2026-10-17)

`node neon/baseline/build.mjs` gera `neon/baseline/neon.sql` (raw + patches de identidade:
`current_usuario_id()`, `usuarios.clerk_user_id/email/convite_enviado_em`, guard
`session_user = 'neondb_owner'`, GRANTs para `authenticated`). Falha se algum padrão sumir.

Aplicado no branch `baseline-teste` (`br-royal-flower-b6enksr9`) numa transação só, sem erro.
Paridade contra o Supabase (hash por categoria): enums, colunas (474), constraints (272),
índices (131), triggers (73), policies (78, texto incluso), views, RLS, funções (86, assinatura)
**idênticos**. Corpos de função: 83/86 idênticos; as 3 diferentes são as patcheadas de propósito
(`enforce_row_cliente_id`, `get_clientes_resumo`, `get_usuarios_com_obras`).

Teste de RLS (2 tenants, `sub` simulado, rollback): cada admin vê só sua obra/usuários/cliente;
inspetor sem vínculo não vê obras; `sub` desconhecido vê 0; inserir obra em outro tenant é barrado.

Teste da Data API com JWT real do Clerk dev (2026-10-17, dados de teste já removidos):
- O token padrão de sessão do Clerk **não tem `role`**: a Data API o aceita (JWKS ok) mas o trata
  como `anonymous` → 403 em tudo. É preciso um **JWT template** `neon` (`jtmp_3KqMHvqqsPoazkt0aNiD24YajTa`,
  claims `{"role":"authenticated"}`, 60s) e `getToken({ template: 'neon' })` no cliente
  (ou adicionar `role` ao session token no dashboard).
- Com o template: `current_usuario_id()`, `get_perfil()`, `has_obra_access()` e as policies funcionam
  via HTTP; o usuário só vê o próprio tenant; UPDATE em obra alheia afeta 0 linhas.
- Guard `enforce_row_cliente_id` está ATIVO via Data API (`session_user` não é o dono): inserir com
  `cliente_id` alheio dá "Tentativa de gravação fora do cliente"; sem `cliente_id`, é preenchido.
- `INSERT ... RETURNING` (Prefer: return=representation) em `obras` falha por RLS, pois `has_obra_access(id)`
  não vê a linha recém-inserida. Já existia no Supabase; o app insere sem `.select()`. Usar `return=minimal`.
- **Conexões novas do pool da Data API chegam SEM o JWT (reproduzido 6x):** a primeira consulta de cada conexão
  nova tem role `authenticated` mas claims vazias (`auth.user_id()` NULL, `request.jwt.claims` com 0 caracteres);
  a RLS então esconde tudo e a resposta é HTTP 200 com `null`/`[]`, indistinguível de "sem dados".
  Acontece depois de ~5 min parado E em rajadas que abrem conexões novas (40 chamadas simultâneas: 14 sem JWT).
  Não é o compute (ficou 24 min acordado e deu igual), não é cache por token (repetir o mesmo token funciona)
  e aquecer UMA conexão não ajuda: a consulta real cai em outra conexão fria (visto no log do servidor).
  **Correção:** `current_usuario_id()` agora levanta `PT401` (`jwt_ausente`) quando o role é `authenticated` e
  não há sub; o PostgREST devolve HTTP 401 e o cliente (`apps/web/lib/neon/retry-fetch.ts`) repete a requisição
  até 6x. Falha explícita em vez de vazio silencioso. Validado: 10/10, 40/40 e 80/80 consultas simultâneas
  corretas. Dono do banco e sub desconhecido continuam retornando NULL sem erro.
  **Histórico do retry no caso "1ª requisição após 6 min parado" (app real, perfil admin):** 6 tentativas com
  espera de 100 ms crescente: FALHOU (esgotou); 8 tentativas com espera exponencial: FALHOU (esgotou em 12,6 s,
  o mesmo GET /usuarios 8x seguidas); com `Connection: close` a partir da 3ª tentativa: PASSOU 2 de 2 (1,4 e
  2,1 s; a consulta que travava resolveu na 3ª tentativa). Amostra pequena. Pedir conexão nova já na 2ª
  tentativa NÃO é melhor: em rajadas triplica as repetições (conexão nova também nasce fria). Hipótese de
  trabalho: o keep-alive devolve repetidamente a mesma conexão ruim do pool. Não provada.
  Reportar à Neon. O mobile/PowerSync precisará do mesmo tratamento.
- Funções novas só aparecem na Data API depois de reaplicar `update_data_api` (`NOTIFY pgrst` não funcionou).

Funções novas do Neon (substituem a service role do painel web; `extra/10_web_rpcs.sql`): `excluir_obra`,
`plataforma_criar_cliente`, `plataforma_atualizar_cliente` (SECURITY DEFINER, checam o chamador dentro do banco) e
`criar_usuario` (SECURITY INVOKER, atômica, sob a RLS do admin). Testadas com usuários reais, incluindo as negativas.

Limitações conhecidas:
- `get_usuarios_com_obras().ultimo_acesso` agora é sempre NULL (sem fonte; viria do Clerk).
- `authenticated` não tem USAGE no schema `auth`; só `current_usuario_id()` (SECURITY DEFINER) o acessa.
- Não testado: a publication/sync do PowerSync, escrita pelas telas reais do app e upload R2.

## Dados (não incluídos)

4 usuários em `auth.users`; 348 `verificacao_itens`, 281 `fvs_padrao_itens`, 145
`fvs_planejadas`, 85 `verificacoes`, 40 `ambientes`, 7 `obras`, 7 `nao_conformidades`.
As estatísticas do `list_tables` mostravam 0 linhas (desatualizadas) — usar `count(*)`.
