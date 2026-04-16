# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable

# ── builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy workspace manifests first (layer cache: reinstall only when these change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json         ./apps/web/

RUN pnpm install --frozen-lockfile

# Copy source after install
COPY packages/shared ./packages/shared
COPY apps/web        ./apps/web

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm --filter @prumoq/web build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# next output: standalone creates a self-contained server
# outputFileTracingRoot = monorepo root → server.js lives at apps/web/server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
