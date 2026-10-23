// Virada da produção: Supabase `prumoq` (xdeyoxdtfbueuymvbsbl) passa a usar Clerk de produção + PowerSync.
// Mesmo patch ensaiado no `prumoq-teste` (neon/baseline/supabase.sql), aplicado no banco que já tem schema e dados.
//
// Uso (segredos num arquivo FORA do repo, nunca no chat):
//   node --env-file=C:/Users/Railton/.prumoq-prod.env neon/virada/virada.mjs <etapa>
//
// Etapas, nesta ordem: conferir | backup | templates | usuarios | patch | auth | powersync | verificar
// `conferir` e `verificar` só leem. As demais podem ser repetidas (idempotentes).
//
// Variáveis:
//   SUPABASE_ACCESS_TOKEN     token da Management API (roda SQL como `postgres`)
//   CLERK_SECRET_KEY          sk_live_... (instância de PRODUÇÃO do Clerk)
//   CLERK_PUBLISHABLE_KEY     pk_live_... (dela sai o emissor dos tokens)
//   PS_DATABASE_PASSWORD      senha da role pq_powersync (a mesma vai para a instância Production do PowerSync)
//   BACKUP_DIR                pasta fora do repo para o backup e o mapa de usuários (tem hashes de senha)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// VIRADA_REF aponta as etapas SÓ DE LEITURA para outro projeto (ex.: o prumoq-teste, para conferir o script).
const LEITURA = ['conferir', 'backup', 'verificar'];
if (process.env.VIRADA_REF && !LEITURA.includes(process.argv[2])) throw new Error('VIRADA_REF só vale para conferir/backup/verificar');
const REF = process.env.VIRADA_REF || 'xdeyoxdtfbueuymvbsbl';
const POWERSYNC_URL = 'https://6ad62293423e048d1cdcfde2.powersync.journeyapps.com'; // instância Production
const BASELINE = join(dirname(fileURLToPath(import.meta.url)), '..', 'baseline');
const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`falta a variável ${k}`);
  return v;
};
const backupDir = () => {
  const d = env('BACKUP_DIR');
  if (d.replace(/\\/g, '/').includes('/Code/prumoq')) throw new Error('BACKUP_DIR não pode ficar dentro do repo');
  mkdirSync(d, { recursive: true });
  return d;
};
const mapaPath = () => join(backupDir(), 'clerk-map.json');

// ---------- Supabase (Management API) ----------
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`SQL falhou (${r.status}): ${body?.message ?? JSON.stringify(body)}`);
  return body;
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ---------- Clerk (Backend API de PRODUÇÃO) ----------
function clerkKey() {
  const k = env('CLERK_SECRET_KEY');
  if (!k.startsWith('sk_live_')) throw new Error('CLERK_SECRET_KEY não é de produção (sk_live_)');
  return k;
}
async function clerk(method, path, body) {
  const r = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${clerkKey()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Clerk ${method} ${path} (${r.status}): ${JSON.stringify(json?.errors ?? json)}`);
  return json;
}
function clerkIssuer() {
  const pk = env('CLERK_PUBLISHABLE_KEY');
  if (!pk.startsWith('pk_live_')) throw new Error('CLERK_PUBLISHABLE_KEY não é de produção (pk_live_)');
  const host = Buffer.from(pk.slice('pk_live_'.length), 'base64').toString('utf8').replace(/\$$/, '');
  return `https://${host}`;
}

// ---------- etapas ----------
const ESTADO = `select
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r') as tabelas,
  (select count(*) from pg_policies where schemaname = 'public') as policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as funcoes,
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal) as triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc ilike '%auth.uid()%') as funcoes_com_auth_uid,
  (select count(*) from pg_policies where schemaname = 'public'
     and (coalesce(qual, '') ilike '%auth.uid()%' or coalesce(with_check, '') ilike '%auth.uid()%')) as policies_com_auth_uid,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'usuarios'
     and column_name = 'clerk_user_id') as tem_clerk_user_id,
  (select count(*) from auth.users) as usuarios_auth,
  (select count(*) from public.usuarios) as usuarios_app,
  (select count(*) from pg_publication_tables where pubname = 'powersync') as tabelas_publicacao,
  exists (select 1 from pg_roles where rolname = 'pq_powersync' and rolreplication) as role_pq_powersync,
  (select json_agg(json_build_object('slot', slot_name, 'ativo', active,
     'retido', pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn))))
     from pg_replication_slots) as slots,
  (select pg_size_pretty(sum(size)) from pg_ls_waldir()) as wal,
  pg_size_pretty(pg_database_size(current_database())) as banco`;

async function conferir() {
  const [e] = await sql(ESTADO);
  console.table(e);
  // Esperado antes da virada: 40 tabelas, 78 policies, 73 triggers, sem clerk_user_id.
  const avisos = [];
  if (e.tabelas !== 40) avisos.push(`tabelas = ${e.tabelas} (esperado 40)`);
  if (e.policies !== 78) avisos.push(`policies = ${e.policies} (esperado 78)`);
  if (e.triggers !== 73 && !e.tem_clerk_user_id) avisos.push(`triggers = ${e.triggers} (esperado 73)`);
  console.log(avisos.length ? `ATENÇÃO:\n- ${avisos.join('\n- ')}` : 'schema no estado esperado');
}

async function backup() {
  const dir = join(backupDir(), `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(join(dir, 'dados'), { recursive: true });
  const tabelas = (await sql(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1`)).map((r) => r.relname);
  const contagens = {};
  for (const t of tabelas) {
    const linhas = [];
    for (let off = 0; ; off += 300) {
      const [{ j }] = await sql(`select coalesce(json_agg(x), '[]'::json) as j from
        (select * from public.${JSON.stringify(t)} order by ctid offset ${off} limit 300) x`);
      linhas.push(...j);
      if (j.length < 300) break;
    }
    writeFileSync(join(dir, 'dados', `${t}.json`), JSON.stringify(linhas));
    const [{ n }] = await sql(`select count(*)::int as n from public.${JSON.stringify(t)}`);
    if (n !== linhas.length) throw new Error(`${t}: copiadas ${linhas.length}, banco tem ${n}`);
    contagens[t] = n;
  }
  // auth.users completo (inclui hash bcrypt): é o que permite recriar os logins se algo der errado.
  writeFileSync(join(dir, 'auth-users.json'), JSON.stringify(await sql('select * from auth.users order by created_at')));
  // Catálogo: o que o patch altera (funções, policies, triggers, grants, publicação), para comparar ou desfazer.
  const catalogo = {
    funcoes: await sql(`select p.oid::regprocedure::text as sig, pg_get_functiondef(p.oid) as def, p.proacl::text as acl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'`),
    policies: await sql(`select * from pg_policies where schemaname = 'public'`),
    triggers: await sql(`select c.relname, t.tgname, pg_get_triggerdef(t.oid) as def from pg_trigger t
      join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal`),
    constraints: await sql(`select conrelid::regclass::text as tabela, conname, pg_get_constraintdef(oid) as def
      from pg_constraint where connamespace = 'public'::regnamespace`),
    colunas: await sql(`select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`),
    grants_tabelas: await sql(`select c.relname, c.relacl::text as acl from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v')`),
    publicacao_powersync: await sql(`select * from pg_publication_tables where pubname = 'powersync'`),
  };
  writeFileSync(join(dir, 'catalogo.json'), JSON.stringify(catalogo, null, 1));
  writeFileSync(join(dir, 'contagens.json'), JSON.stringify(contagens, null, 1));
  console.log(`backup em ${dir}: ${tabelas.length} tabelas, ${Object.values(contagens).reduce((a, b) => a + b, 0)} linhas`);
}

async function templates() {
  // Mesmos templates do Clerk dev: `neon` (role para a API do Supabase; nome histórico) e `powersync` (aud da instância).
  const desejados = [
    { name: 'neon', claims: { role: 'authenticated' }, lifetime: 60, allowed_clock_skew: 5 },
    { name: 'powersync', claims: { aud: POWERSYNC_URL }, lifetime: 300, allowed_clock_skew: 5 },
  ];
  const existentes = await clerk('GET', '/jwt_templates');
  for (const t of desejados) {
    const atual = existentes.find((e) => e.name === t.name);
    const r = atual ? await clerk('PATCH', `/jwt_templates/${atual.id}`, t) : await clerk('POST', '/jwt_templates', t);
    console.log(atual ? 'atualizado' : 'criado', t.name, r.id);
  }
}

async function usuarios() {
  // Cada usuário de auth.users vira usuário do Clerk de produção com a MESMA senha (hash bcrypt do Supabase).
  const auth = await sql(`select id, email, encrypted_password, created_at from auth.users order by created_at`);
  const mapa = existsSync(mapaPath()) ? JSON.parse(readFileSync(mapaPath(), 'utf8')) : {};
  for (const u of auth) {
    const senha = u.encrypted_password ? { password_digest: u.encrypted_password, password_hasher: 'bcrypt' } : {};
    const achados = await clerk('GET', `/users?email_address=${encodeURIComponent(u.email)}`);
    if (achados[0]) {
      await clerk('PATCH', `/users/${achados[0].id}`, { ...senha, skip_password_checks: true, external_id: u.id });
      mapa[u.id] = achados[0].id;
      console.log('já existia, senha sincronizada:', u.email, achados[0].id);
    } else {
      const novo = await clerk('POST', '/users', {
        email_address: [u.email], ...senha, skip_password_checks: true, external_id: u.id,
        created_at: new Date(u.created_at).toISOString(),
      });
      mapa[u.id] = novo.id;
      console.log('criado:', u.email, novo.id);
    }
  }
  writeFileSync(mapaPath(), JSON.stringify(mapa, null, 2));
  console.log(`mapa (${Object.keys(mapa).length} usuários) em ${mapaPath()}`);
}

async function patch() {
  if (!existsSync(mapaPath())) throw new Error('rode a etapa `usuarios` antes (falta o clerk-map.json)');
  const mapa = JSON.parse(readFileSync(mapaPath(), 'utf8'));
  await sql(readFileSync(join(BASELINE, 'supabase.sql'), 'utf8'));
  console.log('supabase.sql aplicado');
  const valores = Object.entries(mapa).map(([id, c]) => `(${lit(id)}::uuid, ${lit(c)})`).join(', ');
  await sql(`begin;
    update public.usuarios u set clerk_user_id = m.c from (values ${valores}) as m(id, c) where u.id = m.id;
    commit;`);
  const semClerk = await sql(`select id, nome, ativo from public.usuarios where clerk_user_id is null`);
  console.log(semClerk.length ? 'usuários SEM conta no Clerk:' : 'todos os usuários ligados ao Clerk', semClerk.length ? semClerk : '');
}

async function auth() {
  // O Supabase passa a aceitar tokens do Clerk de produção ("third-party auth").
  const issuer = clerkIssuer();
  const base = `https://api.supabase.com/v1/projects/${REF}/config/auth/third-party-auth`;
  const headers = { Authorization: `Bearer ${env('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' };
  const atuais = await (await fetch(base, { headers })).json();
  if (atuais.some((a) => a.oidc_issuer_url === issuer)) return console.log('já configurado:', issuer);
  const r = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ oidc_issuer_url: issuer }) });
  const body = await r.json();
  if (!r.ok) throw new Error(`third-party auth (${r.status}): ${JSON.stringify(body)}`);
  console.log('Clerk de produção aceito pelo Supabase:', body.type, body.oidc_issuer_url);
}

async function powersync() {
  await sql(readFileSync(join(BASELINE, 'supabase-powersync.sql'), 'utf8'));
  await sql(`alter role pq_powersync password ${lit(env('PS_DATABASE_PASSWORD'))}`);
  console.log('role pq_powersync e publicação powersync prontas');
}

async function verificar() {
  const [e] = await sql(ESTADO);
  const [x] = await sql(`select
    (select count(*) from public.usuarios where clerk_user_id is null and ativo) as ativos_sem_clerk,
    to_regprocedure('public.current_usuario_id()') is not null as current_usuario_id,
    to_regprocedure('public.registrar_heartbeat()') is not null as heartbeat,
    to_regprocedure('public.criar_usuario(text,text,text,text,perfil_usuario,uuid[])') is not null as criar_usuario,
    (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'obra_id'
       and table_name in ('verificacoes', 'verificacao_itens', 'verificacao_fotos', 'nao_conformidades')) as obra_id_powersync`);
  const issuer = process.env.CLERK_PUBLISHABLE_KEY ? clerkIssuer() : null;
  const tpa = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth/third-party-auth`,
    { headers: { Authorization: `Bearer ${env('SUPABASE_ACCESS_TOKEN')}` } })).json();
  const checks = [
    ['0 funções com auth.uid()', e.funcoes_com_auth_uid === 0],
    ['0 policies com auth.uid()', e.policies_com_auth_uid === 0],
    ['78 policies', e.policies === 78],
    ['usuarios.clerk_user_id existe', e.tem_clerk_user_id],
    ['todo usuário ativo ligado ao Clerk', x.ativos_sem_clerk === 0],
    ['current_usuario_id / heartbeat / criar_usuario', x.current_usuario_id && x.heartbeat && x.criar_usuario],
    ['obra_id do PowerSync nas tabelas filhas', x.obra_id_powersync === 4],
    ['publicação powersync com 30 tabelas', e.tabelas_publicacao === 30],
    ['role pq_powersync com REPLICATION', e.role_pq_powersync],
    ['third-party auth do Clerk de produção', issuer ? tpa.some((a) => a.oidc_issuer_url === issuer) : false],
  ];
  for (const [nome, ok] of checks) console.log(ok ? 'OK   ' : 'FALHA', nome);
  console.table({ funcoes: e.funcoes, triggers: e.triggers, wal: e.wal, banco: e.banco, slots: JSON.stringify(e.slots) });
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}

const etapas = { conferir, backup, templates, usuarios, patch, auth, powersync, verificar };
const etapa = process.argv[2];
if (!etapas[etapa]) {
  console.error(`etapa inválida. Use: ${Object.keys(etapas).join(' | ')}`);
  process.exit(2);
}
etapas[etapa]().catch((err) => { console.error('ERRO', err.message); process.exit(1); });
