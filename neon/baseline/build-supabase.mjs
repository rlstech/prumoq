// Gera neon/baseline/supabase.sql: patch que leva um banco Supabase com o schema "cru" (raw/, extraído do próprio
// Supabase) para o modelo Clerk + PowerSync — o mesmo ponto em que o Neon chegou com build.mjs.
// Uso: node neon/baseline/build-supabase.mjs
//
// Diferente do build.mjs (que cria o banco do zero), aqui o banco JÁ existe com dados: o patch só altera
// colunas, substitui funções (CREATE OR REPLACE), recria as policies que usam auth.uid() e aplica os extras.
// É idempotente e roda numa transação só.
//
// Por que trocar auth.uid(): no Supabase ela converte o `sub` do JWT para uuid. Com o Clerk o sub é `user_xxx`,
// e a conversão quebra. current_usuario_id() faz a ponte pelo usuarios.clerk_user_id.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const raw = (f) => readFileSync(join(dir, 'raw', f), 'utf8')

function patch(name, sql, from, to) {
  if (!sql.includes(from)) throw new Error(`${name}: padrão não encontrado: ${from}`)
  return sql.split(from).join(to)
}

const HEADER = `-- Patch PrumoQ: Supabase -> Clerk + PowerSync (gerado por build-supabase.mjs; não editar à mão)
BEGIN;
SET LOCAL check_function_bodies = off;
`

const USUARIOS = `
-- 1) usuarios: ponte com o Clerk. Usuários novos não existem mais em auth.users.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS clerk_user_id text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS convite_enviado_em timestamp with time zone;
ALTER TABLE public.usuarios ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_clerk_user_id_key') THEN
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_clerk_user_id_key UNIQUE (clerk_user_id);
  END IF;
END
$$;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_id_fkey;
ALTER TABLE public.auditoria_plataforma DROP CONSTRAINT IF EXISTS auditoria_plataforma_ator_id_fkey;
-- e-mail e convite vinham de auth.users
UPDATE public.usuarios u SET email = au.email, convite_enviado_em = au.invited_at
  FROM auth.users au WHERE au.id = u.id AND u.email IS NULL;
`

const CURRENT_USER_FN = `
-- 2) Identidade: sub do Clerk -> usuarios.id
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.id FROM public.usuarios u WHERE u.clerk_user_id = (auth.jwt() ->> 'sub')
$$;
REVOKE ALL ON FUNCTION public.current_usuario_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO authenticated;
`

// Mantém o Supabase acordado (plano gratuito pausa após 7 dias sem atividade). Chamada uma vez por dia pelo
// Cron Trigger do Worker do PWA, com a chave publicável (role anon). Só grava a hora; não lê nada.
const HEARTBEAT = `
-- 6) Heartbeat diário
CREATE TABLE IF NOT EXISTS public.sistema_heartbeat (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ultimo_em timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.sistema_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sistema_heartbeat FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.registrar_heartbeat()
RETURNS timestamp with time zone
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.sistema_heartbeat (id, ultimo_em) VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET ultimo_em = excluded.ultimo_em
  RETURNING ultimo_em
$$;
REVOKE ALL ON FUNCTION public.registrar_heartbeat() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_heartbeat() TO anon, authenticated;
`

// Funções novas: o Supabase dá EXECUTE a PUBLIC por padrão; só `authenticated` deve chamá-las.
const NOVAS = ['excluir_obra', 'plataforma_criar_cliente', 'plataforma_atualizar_cliente', 'criar_usuario']

// --- funções base (todas CREATE OR REPLACE; as que não usam auth.uid() ficam iguais) ---
let fns = ['06a', '06b', '06c', '06d'].map((p) => raw(`${p}_functions.sql`)).join('\n')
fns = patch('06', fns, '      au.invited_at\n', '      u.convite_enviado_em AS invited_at\n')
fns = patch('06', fns, '    JOIN auth.users au ON au.id = u.id\n    WHERE u.cliente_id = c.id', '    WHERE u.cliente_id = c.id')
fns = patch('06', fns, 'lower(au.email)', 'lower(u.email)')
fns = patch('06', fns, 'au.email::varchar', 'u.email::varchar')
fns = patch('06', fns, '    au.last_sign_in_at\n', '    NULL::timestamptz\n')
fns = patch('06', fns, '  FROM public.usuarios u\n  JOIN auth.users au ON au.id = u.id;', '  FROM public.usuarios u;')
fns = fns.replace(/-- NEON-TODO: referencia auth\.users[^\n]*\n/g, '')

// --- policies: só as que usam auth.uid() (as demais já chamam funções do banco) ---
const policies = raw('09_rls_policies.sql').split('\n')
  .filter((l) => l.startsWith('CREATE POLICY ') && l.includes('auth.uid()'))
  .map((l) => {
    const m = l.match(/^CREATE POLICY (\S+) ON (\S+) /)
    if (!m) throw new Error(`policy sem nome/tabela: ${l.slice(0, 80)}`)
    return `DROP POLICY IF EXISTS ${m[1]} ON ${m[2]};\n${l}`
  })
if (policies.length !== 9) throw new Error(`esperava 9 policies com auth.uid(), achei ${policies.length}`)

// --- extras do Neon (funções novas e obra_id do PowerSync); o 20_ tem BEGIN/COMMIT próprios ---
const extra = readdirSync(join(dir, 'extra')).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(join(dir, 'extra', f), 'utf8').replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''))
  .join('\n')

const grants = NOVAS.map((nome) => `DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = '${nome}' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;`).join('\n')

let out = [
  HEADER, USUARIOS, CURRENT_USER_FN,
  '\n-- 3) Funções base com auth.uid() -> current_usuario_id()\n', fns,
  '\n-- 4) Policies que usavam auth.uid()\n', policies.join('\n'),
  '\n-- 5) Funções novas e obra_id do PowerSync\n', extra, grants,
  HEARTBEAT, '\nCOMMIT;\n',
].join('\n')
out = out.replace(/auth\.uid\(\)/g, 'public.current_usuario_id()')

const left = out.match(/auth\.uid\(\)|auth\.user_id\(\)|neondb_owner|anonymous/g)
if (left) throw new Error(`resíduo: ${[...new Set(left)].join(', ')}`)

writeFileSync(join(dir, 'supabase.sql'), out)
console.log(`supabase.sql: ${out.length} bytes, ${policies.length} policies recriadas`)
