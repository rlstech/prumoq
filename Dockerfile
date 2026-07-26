# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable

# ── builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace packages BEFORE install so pnpm workspace symlinks resolve correctly
COPY packages/design-system ./packages/design-system
COPY packages/shared ./packages/shared

# package.json de cada workspace declarado em pnpm-workspace.yaml (apps/*)
# pnpm v10 exige que todos os workspaces existam ao rodar --frozen-lockfile
COPY apps/web/package.json    ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

RUN pnpm install --frozen-lockfile

# Copy app source after install (changes here don't bust the install cache)
COPY apps/web ./apps/web

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

RUN apk add --no-cache chromium font-noto font-noto-cjk font-noto-emoji && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# outputFileTracingRoot points to monorepo root, so standalone mirrors monorepo structure:
# server.js lives at apps/web/server.js inside the standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV PUPPETEER_DISABLE_SANDBOX="true"
ENV XDG_CONFIG_HOME="/tmp/.chromium"
ENV XDG_CACHE_HOME="/tmp/.chromium"

CMD ["node", "apps/web/server.js"]
