// Converte supabase/migrations/*.sql em neon/migrations/*.sql.
// Uso: node neon/build-migrations.mjs
// Cada patch exige que o padrão exista; se o Supabase SQL mudar, o build falha.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'supabase', 'migrations')
const outDir = join(root, 'neon', 'migrations')

const CURRENT_USER_FN = `
-- Neon + Clerk: o sub do JWT é texto (user_xxx), não UUID. usuarios.id continua
-- sendo o UUID interno; clerk_user_id faz a ponte. Substitui auth.uid().
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.id FROM public.usuarios u WHERE u.clerk_user_id = auth.user_id()
$$;

REVOKE ALL ON FUNCTION public.current_usuario_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO authenticated;
`

function patch(name, sql, from, to) {
  const matches = typeof from === 'string' ? sql.split(from).length - 1 : (sql.match(from) ?? []).length
  if (matches === 0) throw new Error(`${name}: padrão não encontrado: ${from}`)
  // `to` literal (split/join) ou função: evita que "$$" vire "$" no replace.
  return typeof from === 'string' ? sql.split(from).join(to) : sql.replace(from, to)
}

const patches = {
  '001_initial_schema.sql': (n, s) => {
    s = patch(n, s, '-- USUÁRIOS (extends Supabase auth.users)', '-- USUÁRIOS (identidade externa no Clerk via clerk_user_id)')
    // 002 (view) já referencia fvs_planejadas.percentual_exec, criada só na 006
    // (006 usa IF NOT EXISTS). O histórico do Supabase foi editado após aplicado.
    s = patch(n, s, `  concluida_em        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(ambiente_id, fvs_padrao_id)`, `  concluida_em        timestamptz,
  percentual_exec     integer not null default 0 check(percentual_exec between 0 and 100),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(ambiente_id, fvs_padrao_id)`)
    s = patch(n, s, 'id          uuid primary key references auth.users(id) on delete cascade,',
      `id          uuid primary key default uuid_generate_v4(),
  clerk_user_id text unique,
  email       text,
  convite_enviado_em timestamptz,`)
    // a função precisa existir antes das primeiras policies que a usam
    return patch(n, s, /create table usuarios \([\s\S]*?\n\);\n/, (m) => `${m}\n${CURRENT_USER_FN}`)
  },
  '027_multitenancy_foundation.sql': (n, s) =>
    patch(n, s, 'ator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,', 'ator_id uuid,'),
  '030_multitenancy_write_guards.sql': (n, s) =>
    patch(n, s, "auth.role() = 'service_role'", "session_user = 'neondb_owner'"),
  '036_cliente_admin_onboarding.sql': (n, s) => {
    s = patch(n, s, /UPDATE public\.usuarios AS u\nSET onboarding_concluido_em = COALESCE\(au\.email_confirmed_at, u\.created_at\)\nFROM auth\.users AS au\nWHERE au\.id = u\.id\n  AND au\.invited_at IS NULL\n  AND u\.onboarding_concluido_em IS NULL;/,
      `UPDATE public.usuarios AS u
SET onboarding_concluido_em = u.created_at
WHERE u.convite_enviado_em IS NULL
  AND u.onboarding_concluido_em IS NULL;`)
    s = patch(n, s, '      au.invited_at\n', '      u.convite_enviado_em AS invited_at\n')
    s = patch(n, s, '    JOIN auth.users au ON au.id = u.id\n', '')
    return patch(n, s, 'lower(au.email)', 'lower(u.email)')
  },
  // uuid-ossp já expõe uuid_generate_v4() em public no Neon.
  '047_uuid_v4_schema_compatibility.sql': () =>
    '-- Neon: uuid-ossp instala uuid_generate_v4() em public; nada a fazer.\n',
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const files = readdirSync(srcDir).filter((f) => f.endsWith('.sql')).sort()
for (const f of files) {
  let sql = readFileSync(join(srcDir, f), 'utf8')
  if (patches[f]) sql = patches[f](f, sql)
  sql = sql.replace(/auth\.uid\(\)/g, 'public.current_usuario_id()')
  sql = sql.replace(/\banon\b/g, 'anonymous')
  const left = sql.match(/auth\.(users|role|jwt)|service_role|extensions\./g)
  if (left) throw new Error(`${f}: resíduo Supabase: ${[...new Set(left)].join(', ')}`)
  writeFileSync(join(outDir, f), sql)
}
console.log(`${files.length} migrations geradas em neon/migrations`)
