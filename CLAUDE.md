# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# INSTRUÇÕES PARA O CLAUDE CODE — PrumoQ

Este arquivo orienta o Claude Code sobre como desenvolver o PrumoQ.
Leia todos os arquivos de spec antes de começar qualquer implementação.

## Estado Atual do Projeto

**Fase 1 concluída** — infraestrutura do monorepo criada, sem código de telas ainda.

```
prumoq/
  apps/mobile/       ← Expo 52 + Expo Router + PowerSync (stubs de telas)
  apps/web/          ← Next.js 14 + Tailwind (stubs de telas)
  packages/shared/   ← tipos TypeScript + enums (todos os 15 tipos do schema)
  supabase/
    migrations/001_initial_schema.sql
    functions/r2-presign/   ← Edge Function Cloudflare R2
  references/        ← protótipos HTML (não modificar)
```

Próximos passos: Fase 2 (telas mobile) e Fase 3 (telas admin).

## Arquitetura

### Mobile — Roteamento e Auth

O Expo Router usa dois grupos de rotas no diretório `apps/mobile/app/`:

```
app/
  _layout.tsx          ← Root layout: inicializa PowerSync, escuta auth state
  (auth)/
    login.tsx
  (app)/
    _layout.tsx        ← Redireciona para login se não autenticado
    (tabs)/
      _layout.tsx      ← Tab bar (Dashboard, Obras, NCs, Perfil)
      index.tsx        ← Dashboard
      obras/index.tsx
      nc/index.tsx
      perfil/index.tsx
```

O `app/_layout.tsx` é o ponto central: inicializa `db.init()`, chama `db.connect(new SupabaseConnector())` ao fazer login e `db.disconnect()` + `db.clearLocal()` ao fazer logout.

**Row types do PowerSync** — exportados de `apps/mobile/lib/schema.ts`:
`ObrasRow`, `AmbientesRow`, `VerificacoesRow`, `NaoConformidadesRow`, etc.

### Web — Clientes Supabase

Dois padrões distintos em `apps/web/lib/supabase/`:

- `server.ts` — usa `@supabase/ssr` com cookies do Next.js. Use em Server Components e Server Actions.
- `client.ts` — cliente browser padrão. Use em Client Components (`'use client'`).

Ambos tipados com `Database` de `@prumoq/shared`.

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
pnpm web                  # inicia Next.js dev server (apps/web)
pnpm build:web            # build de produção do painel web

pnpm typecheck            # typecheck em todos os workspaces
pnpm lint                 # lint (somente apps/web — mobile não tem lint script)
```

### Supabase
```bash
# Executar schema no Supabase:
# Colar supabase/migrations/001_initial_schema.sql no SQL Editor do Supabase Dashboard

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

### Fase 2 — App Mobile
1. ✅ Expo Router setup + autenticação (grupos de rota + auth state)
2. ✅ PowerSync + SupabaseConnector (schema + connector implementados)
3. Dashboard com queries reais
4. Fluxo Obras → Ambiente → FVS → Histórico
5. Nova Verificação (a tela mais complexa)
6. Upload de fotos offline-first
7. Assinatura digital
8. NC abertas

### Fase 3 — Painel Admin
1. Next.js setup + Supabase SSR
2. Login + middleware de autenticação
3. Dashboard com dados reais
4. CRUD Empresas + Obras
5. FVS Padrão (biblioteca + editor de revisões)
6. Ambientes + FVS Planner
7. Equipes + Usuários
8. Verificações (tabela + modal com galeria de fotos)
9. NC centralizada
10. Relatórios + geração de PDF

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
