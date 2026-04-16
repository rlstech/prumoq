# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# INSTRUÇÕES PARA O CLAUDE CODE — PrumoQ

Este arquivo orienta o Claude Code sobre como desenvolver o PrumoQ.
Leia todos os arquivos de spec antes de começar qualquer implementação.

## Estado Atual do Projeto

**Fase 1 concluída** — infraestrutura do monorepo criada.  
**Fase 2 concluída** — todas as 9 telas mobile implementadas com queries reais, offline-first, upload de fotos e assinatura digital. App também roda como PWA no browser via shim.  
**Fase 3 em andamento** — painel admin Next.js com login, dashboard, obras, FVS, equipes, usuários e verificações implementados.

```
prumoq/
  apps/mobile/       ← Expo 52 + Expo Router + PowerSync (9 telas completas + PWA)
  apps/web/          ← Next.js 14 + Tailwind (Fase 3 em andamento)
  packages/shared/   ← tipos TypeScript + enums (todos os 15 tipos do schema)
  supabase/
    migrations/001_initial_schema.sql
    migrations/002_web_views_and_rpcs.sql   ← RPCs usados pelo web shim
    functions/r2-presign/   ← Edge Function Cloudflare R2
  references/        ← protótipos HTML (não modificar)
```

## Arquitetura

### Mobile — Roteamento e Auth

O Expo Router usa dois grupos de rotas no diretório `apps/mobile/app/`:

```
app/
  _layout.native.tsx   ← Root layout nativo: inicializa PowerSync, escuta auth state
  _layout.web.tsx      ← Root layout web: importa setup-rn-web.ts PRIMEIRO, sem PowerSync
  _layout.tsx          ← Fallback (não deve ser alcançado — native/web são resolvidos antes)
  (auth)/login.tsx
  (app)/
    _layout.tsx        ← Redireciona para login se não autenticado
    (tabs)/
      _layout.tsx      ← Tab bar (Dashboard, Obras, NCs, Perfil)
      index.tsx        ← Dashboard
      obras/
        index.tsx
        [id]/index.tsx
        [id]/ambiente/[ambId]/index.tsx
        [id]/ambiente/[ambId]/fvs/[fvsId]/index.tsx         ← Histórico FVS
        [id]/ambiente/[ambId]/fvs/[fvsId]/verificacao/nova.tsx  ← Nova Verificação
      nc/index.tsx
      perfil/index.tsx
```

O `_layout.native.tsx` é o ponto central nativo: inicializa `db.init()`, chama `db.connect(new SupabaseConnector())` ao fazer login e `db.disconnectAndClear()` ao fazer logout.

**Row types do PowerSync** — exportados de `apps/mobile/lib/schema.ts`:
`ObrasRow`, `AmbientesRow`, `VerificacoesRow`, `NaoConformidadesRow`, etc.

### Mobile — Arquivos de Plataforma

Metro resolve automaticamente variantes por plataforma na ordem:
1. `arquivo.native.tsx` → nativo (iOS/Android)
2. `arquivo.web.tsx` → web/PWA
3. `arquivo.tsx` → fallback

Arquivos com split de plataforma em `apps/mobile/lib/`:
- `powersync.ts` / `powersync.web.ts` — nativo usa `PowerSyncDatabase`; web re-exporta do shim
- `schema.ts` / `schema.web.ts` — nativo usa schema PowerSync completo; web exporta `{}`
- `supabase.ts` / `supabase.web.ts` — mesma API, cliente browser no web
- `powersync-web-shim.ts` — substitui PowerSync no browser, mapeando SQL para Supabase REST/RPCs

### Mobile — PWA / Web Shim

O app mobile roda como PWA no browser. O arquivo `apps/mobile/lib/powersync-web-shim.ts` implementa a mesma interface de `db` e `usePowerSyncQuery`, mas despacha para Supabase REST diretamente. Cada tela usa o mesmo código; o shim recebe as queries SQL e as mapeia para chamadas Supabase.

**Ao adicionar uma nova tela/query no mobile**, também é preciso adicionar o padrão correspondente em `powersync-web-shim.ts` para que a versão web funcione. Queries complexas com JOINs usam RPCs definidas em `supabase/migrations/002_web_views_and_rpcs.sql`.

**`apps/mobile/lib/setup-rn-web.ts`** — DEVE ser o primeiro import em `_layout.web.tsx`. Corrige crash do NativeWind no web ao inicializar o dark mode antes que o MutationObserver do React Native Web seja registrado.

### Web — Clientes Supabase

Dois padrões distintos em `apps/web/lib/supabase/`:

- `server.ts` — usa `@supabase/ssr` com cookies do Next.js. Use em Server Components e Server Actions.
- `client.ts` — cliente browser padrão. Use em Client Components (`'use client'`).

Para operações admin (criar/editar usuários via `auth.admin.*`), use `createClient` direto com `SUPABASE_SERVICE_ROLE_KEY` — veja `apps/web/app/(admin)/usuarios/actions.ts` como modelo.

Ambos tipados com `Database` de `@prumoq/shared`.

### Web — Server Actions

Server Actions ficam em `actions.ts` dentro da pasta da rota (convenção do projeto):
- `apps/web/app/(admin)/usuarios/actions.ts` — CRUD de usuários (usa service role key)
- `apps/web/app/(auth)/login/actions.ts` — login; bloqueia perfil `inspetor` (uso restrito ao mobile)
- `apps/web/app/(admin)/equipes/actions.ts` — CRUD de equipes
- `apps/web/app/(admin)/obras/[id]/actions.ts` — operações sobre obra específica (ambientes, associações)

Perfis `inspetor` são impedidos de acessar o painel web — o `loginAction` retorna erro e faz signOut.

### Shared Package

`@prumoq/shared` exporta apenas:
- `Database` — tipos gerados pelo Supabase (regenerar após migrations com `supabase gen types`)
- Enums (`StatusObra`, `PerfilUsuario`, etc.)

Não há Zod schemas no shared ainda — validação fica em cada app.

## Arquivos de referência (ler nesta ordem antes de implementar)

1. `SPEC.md` — Visão geral, stack, personas, hierarquia de dados, regras de negócio
2. `schema.sql` — Schema completo do banco Supabase (já copiado para `supabase/migrations/001_initial_schema.sql`)
3. `design-system.md` — Cores, tipografia, componentes, padrões visuais
4. `screens-mobile.md` — Especificação de todas as telas do app React Native
5. `screens-admin.md` — Especificação de todas as telas do painel Next.js
6. `sync-rules.md` — Schema PowerSync, regras de sync, upload de fotos offline
7. `references/prumoq_mobile_inspector.html` — Protótipo visual do app mobile **(REFERÊNCIA DE DESIGN)**
8. `references/fvs_admin_prumoq.html` — Protótipo visual do painel admin **(REFERÊNCIA DE DESIGN)**

## Comandos

### Pré-requisitos (instalar uma vez)
```bash
# Node.js 20+ — https://nodejs.org
# pnpm 9+
npm install -g pnpm
```

### Desenvolvimento
```bash
pnpm install              # instala todas as dependências do monorepo

pnpm mobile               # inicia Expo (apps/mobile)
pnpm mobile:web           # inicia Expo no browser (PWA)
pnpm mobile:build:web     # build do PWA
pnpm web                  # inicia Next.js dev server (apps/web)
pnpm build:web            # build de produção do painel web

pnpm typecheck            # typecheck em todos os workspaces
pnpm lint                 # lint (somente apps/web — mobile não tem lint script)
```

### Supabase
```bash
# Executar schema no Supabase:
# Colar supabase/migrations/001_initial_schema.sql no SQL Editor do Supabase Dashboard
# Colar supabase/migrations/002_web_views_and_rpcs.sql também

# Gerar tipos TypeScript após aplicar o schema:
npx supabase gen types typescript --project-id <id> \
  > packages/shared/src/database.types.ts

# Deploy da Edge Function:
supabase functions deploy r2-presign

# Definir secrets da Edge Function:
supabase secrets set \
  R2_ACCOUNT_ID=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=prumoq-fotos
```

## Variáveis de Ambiente

Copie `.env.example` e preencha:

| Variável | Onde usar |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` |
| `EXPO_PUBLIC_POWERSYNC_URL` | `apps/mobile/.env` |
| `EXPO_PUBLIC_R2_PUBLIC_URL` | `apps/mobile/.env` |
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/web/.env.local` |
| `R2_ACCOUNT_ID` | Supabase secrets (Edge Function) |
| `R2_ACCESS_KEY_ID` | Supabase secrets (Edge Function) |
| `R2_SECRET_ACCESS_KEY` | Supabase secrets (Edge Function) |
| `R2_BUCKET_NAME` | Supabase secrets (Edge Function) |

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
- Após aplicar o schema no Supabase, regerar os tipos com `supabase gen types`

### React Native
- Expo SDK 52
- Expo Router para navegação (file-based, diretório `app/`)
- `StyleSheet.create()` ou NativeWind para estilos
- `SafeAreaView` em todas as telas
- Testar em iOS e Android

### Next.js
- App Router (não Pages Router)
- Server Components por padrão
- Client Components só quando necessário (`'use client'`)
- Tailwind CSS — tokens de cor em `tailwind.config.ts`
- Middleware (`middleware.ts`) protege todas as rotas admin
- Server Actions em `actions.ts` junto à rota que as usa

### Banco de Dados
- Usar `@prumoq/shared` — client tipado com `Database`
- RLS sempre ativo — nunca `supabase.rpc()` sem verificação
- `supabase.from().select()` com joins ao invés de múltiplas queries
- No mobile: `usePowerSyncQuery()` para queries reativas

### PowerSync
- Schema local em `apps/mobile/lib/schema.ts` (15 tabelas)
- `SupabaseConnector` em `apps/mobile/lib/supabase-connector.ts`
- `usePowerSyncQuery()` para queries reativas
- `db.execute()` para writes offline
- Sempre passar `created_offline: 1` em novos registros
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
- **RN-09:** App 100% funcional offline — todo write vai via PowerSync

## Design

**O design dos protótipos HTML em `references/` é a referência definitiva.**

Ao implementar qualquer tela:
1. Abra o arquivo HTML de referência correspondente (`prumoq_mobile_inspector.html` para mobile, `fvs_admin_prumoq.html` para web)
2. Identifique os tokens de cor e espaçamento no `design-system.md`
3. Reproduza o layout fielmente usando os tokens
4. Use Lucide React/React Native para ícones (não emoji)

Cores principais para consulta rápida (também em `apps/mobile/lib/constants.ts` e `apps/web/tailwind.config.ts`):
- Brand: `#E84A1A`
- OK/Conforme: `#2E7D32`
- NOK/Não conforme: `#C62828`
- Progress/Em andamento: `#1565C0`
- Warn/Prazo: `#E65100`
