// Gera neon/baseline/neon.sql a partir de neon/baseline/raw/*.sql (extraído do Supabase).
// Uso: node neon/baseline/build.mjs
// Cada patch exige que o padrão exista; se o raw mudar, o build falha.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const raw = (f) => readFileSync(join(dir, 'raw', f), 'utf8')

function patch(name, sql, from, to) {
  if (!sql.includes(from)) throw new Error(`${name}: padrão não encontrado: ${from}`)
  return sql.split(from).join(to)
}

const HEADER = `-- Baseline PrumoQ para Neon + Clerk (gerado por build.mjs; não editar à mão)
SET check_function_bodies = off;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
`

// O sub do JWT do Clerk é texto (user_xxx), não UUID. usuarios.id continua sendo o
// UUID interno; clerk_user_id faz a ponte. Substitui auth.uid().
const CURRENT_USER_FN = `
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub text := auth.user_id();
BEGIN
  -- A Data API do Neon entrega a primeira consulta de cada conexao nova do pool SEM o JWT (o role ja e
  -- authenticated, mas as claims vem vazias). Sem este erro, a RLS esconderia tudo e a resposta seria 200 com
  -- lista vazia, indistinguivel de "sem dados". PT401 vira HTTP 401 no PostgREST e o cliente repete a requisicao.
  IF v_sub IS NULL AND current_setting('role', true) = 'authenticated' THEN
    RAISE EXCEPTION 'jwt_ausente' USING ERRCODE = 'PT401', HINT = 'A Data API nao entregou o JWT a esta conexao; repita a requisicao.';
  END IF;
  RETURN (SELECT u.id FROM public.usuarios u WHERE u.clerk_user_id = v_sub);
END
$$;
REVOKE ALL ON FUNCTION public.current_usuario_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO authenticated;
`

const GRANTS = `
GRANT USAGE ON SCHEMA public TO authenticated, anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
`

let types = raw('01_types.sql')

let tables = raw('02_tables.sql')
tables = patch('02', tables, 'extensions.uuid_generate_v4()', 'uuid_generate_v4()')
tables = patch('02', tables, `CREATE TABLE public.usuarios (
  id uuid NOT NULL,`, `CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  clerk_user_id text UNIQUE,
  email text,
  convite_enviado_em timestamp with time zone,`)

let fns = ['06a', '06b', '06c', '06d'].map((p) => raw(`${p}_functions.sql`)).join('\n')
// get_clientes_resumo: auth.users -> colunas próprias de usuarios
fns = patch('06', fns, '      au.invited_at\n', '      u.convite_enviado_em AS invited_at\n')
fns = patch('06', fns, '    JOIN auth.users au ON au.id = u.id\n    WHERE u.cliente_id = c.id', '    WHERE u.cliente_id = c.id')
fns = patch('06', fns, 'lower(au.email)', 'lower(u.email)')
// get_usuarios_com_obras: sem fonte local de último acesso (viria do Clerk)
fns = patch('06', fns, 'au.email::varchar', 'u.email::varchar')
fns = patch('06', fns, '    au.last_sign_in_at\n', '    NULL::timestamptz\n')
fns = patch('06', fns, '  FROM public.usuarios u\n  JOIN auth.users au ON au.id = u.id;', '  FROM public.usuarios u;')
fns = fns.replace(/-- NEON-TODO: referencia auth\.users[^\n]*\n/g, '')

const views = raw('07_views.sql')
const rest = ['03_constraints', '04_indexes', '05_foreign_keys'].map((f) => raw(`${f}.sql`))
rest[2] = rest[2].replace(/^-- SUPABASE-ONLY:.*\n/gm, '')
const triggers = raw('08_triggers.sql')
const policies = raw('09_rls_policies.sql')

// funções novas do Neon (substituem a service role); precisam vir depois das funções base e antes dos GRANTs
const extra = readdirSync(join(dir, 'extra')).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(join(dir, 'extra', f), 'utf8')).join('\n')

let out = [HEADER, types, tables, rest[0], rest[1], rest[2], CURRENT_USER_FN, fns, views, triggers, policies, extra, GRANTS].join('\n')
out = out.replace(/auth\.uid\(\)/g, 'public.current_usuario_id()')
out = out.replace(/auth\.role\(\) = 'service_role'/g, "session_user = 'neondb_owner'")

const left = out.match(/auth\.(users|role|jwt|email)|service_role|extensions\./g)
if (left) throw new Error(`resíduo Supabase: ${[...new Set(left)].join(', ')}`)

writeFileSync(join(dir, 'neon.sql'), out)
console.log(`neon.sql: ${out.length} bytes`)
