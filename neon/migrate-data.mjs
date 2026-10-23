// Pré-requisitos (nada disso fica no repo):
//  - `npm i pg` ao lado do script; supabase-host.txt (pooler) e supabase-pw.txt (senha) no cwd
//  - role temporária pq_migrador (SELECT + BYPASSRLS) e função public.pq_migracao_auth_users()
//    SECURITY DEFINER no Supabase (a role não lê o schema auth). Dropar as duas ao final.
//  - env NEON_URL e CLERK_SECRET_KEY (nunca em arquivo)
// Copia os dados do Supabase para o Neon. Env: NEON_URL, CLERK_SECRET_KEY; senha do Supabase em supabase-pw.txt.
// Trava: só roda no branch de teste (host ep-lively-flower) a menos que MIGRATE_TARGET=prod.
import pg from 'pg'
import { readFileSync, writeFileSync } from 'node:fs'

// timestamps/datas como texto cru: evita perder microssegundos no round-trip
for (const oid of [1082, 1114, 1184, 1083, 1266, 114, 3802]) pg.types.setTypeParser(oid, (v) => v)

const NEON_URL = process.env.NEON_URL
const CLERK = process.env.CLERK_SECRET_KEY
const isProd = process.env.MIGRATE_TARGET === 'prod'
if (!NEON_URL || !CLERK) throw new Error('faltam NEON_URL / CLERK_SECRET_KEY')
if (!isProd && !NEON_URL.includes('ep-lively-flower')) throw new Error('alvo nao e o branch de teste; defina MIGRATE_TARGET=prod para continuar')
console.log('alvo:', isProd ? 'PRODUCAO' : 'branch de teste')

const sb = new pg.Client({
  host: readFileSync('supabase-host.txt', 'utf8').trim(), port: 5432, user: 'pq_migrador.xdeyoxdtfbueuymvbsbl',
  password: readFileSync('supabase-pw.txt', 'utf8').trim(), database: 'postgres', ssl: { rejectUnauthorized: false },
})
const neon = new pg.Client({ connectionString: NEON_URL })
await sb.connect(); await neon.connect()
for (const c of [sb, neon]) await c.query("SET TIME ZONE 'UTC'")

// ---------- 1. Clerk ----------
const clerk = async (method, path, body) => {
  const r = await fetch(`https://api.clerk.com/v1${path}`, { method, headers: { Authorization: `Bearer ${CLERK}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Clerk ${method} ${path} -> ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`)
  return j
}
const { rows: authUsers } = await sb.query('select * from public.pq_migracao_auth_users() order by created_at')
const { rows: perfis } = await sb.query('select id, nome from public.usuarios')
const nomeDe = Object.fromEntries(perfis.map((p) => [p.id, p.nome]))
const clerkIdDe = {}
for (const u of authUsers) {
  if (!u.email) throw new Error(`usuario ${u.id} sem email`)
  const found = await clerk('GET', `/users?email_address=${encodeURIComponent(u.email)}`)
  if (found[0]) {
    // decisao do usuario: conta pre-existente passa a ter a senha do Supabase (e o elo external_id)
    await clerk('PATCH', `/users/${found[0].id}`, { password_digest: u.encrypted_password, password_hasher: 'bcrypt', skip_password_checks: true, ...(found[0].external_id ? {} : { external_id: u.id }) })
    clerkIdDe[u.id] = found[0].id; console.log('clerk: ja existia, senha sincronizada', u.email, found[0].id); continue
  }
  const nome = (nomeDe[u.id] ?? '').trim().split(/\s+/)
  const created = await clerk('POST', '/users', {
    email_address: [u.email], external_id: u.id,
    password_digest: u.encrypted_password, password_hasher: 'bcrypt',
    first_name: nome[0] || undefined, last_name: nome.slice(1).join(' ') || undefined,
    skip_password_checks: true, created_at: new Date(u.created_at).toISOString(),
  })
  clerkIdDe[u.id] = created.id
  console.log('clerk: criado', u.email, created.id)
}
writeFileSync('clerk-map.json', JSON.stringify(clerkIdDe, null, 2))
const faltando = perfis.filter((p) => !clerkIdDe[p.id])
if (faltando.length) throw new Error(`usuarios sem conta no auth.users: ${faltando.map((p) => p.id)}`)

// ---------- 2. Neon ----------
const { rows: tabelas } = await neon.query(`select c.relname t from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' order by 1`)
const nomes = tabelas.map((r) => r.t)
const { rows: fks } = await neon.query(`select conrelid::regclass::text a, confrelid::regclass::text b from pg_constraint where contype='f' and connamespace='public'::regnamespace`)
const deps = Object.fromEntries(nomes.map((n) => [n, new Set()]))
for (const { a, b } of fks) if (a !== b) deps[a].add(b)
const ordem = []; const feito = new Set()
while (ordem.length < nomes.length) {
  const prox = nomes.filter((n) => !feito.has(n) && [...deps[n]].every((d) => feito.has(d)))
  if (!prox.length) throw new Error(`ciclo de FK entre: ${nomes.filter((n) => !feito.has(n))}`)
  for (const n of prox) { ordem.push(n); feito.add(n) }
}
const selfRef = { nao_conformidades: 'nc_anterior_id' }
console.log('ordem de carga:', ordem.join(', '))

const colunasNeon = async (t) => (await neon.query(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`, [t])).rows.map((r) => r.column_name)
const EXTRA_USUARIOS = ['clerk_user_id', 'email', 'convite_enviado_em']
const resumo = {}
try {
  await neon.query('BEGIN')
  for (const t of nomes) await neon.query(`ALTER TABLE public.${t} DISABLE TRIGGER USER`)
  await neon.query(`TRUNCATE ${nomes.map((t) => 'public.' + t).join(', ')} CASCADE`)
  const emailDe = Object.fromEntries(authUsers.map((u) => [u.id, u]))
  for (const t of ordem) {
    let cols = (await colunasNeon(t)).filter((c) => !(t === 'usuarios' && EXTRA_USUARIOS.includes(c)))
    const { rows } = await sb.query(`select ${cols.map((c) => `"${c}"`).join(',')} from public.${t}`)
    const insCols = t === 'usuarios' ? [...cols, ...EXTRA_USUARIOS] : cols
    const adiar = selfRef[t]
    for (const row of rows) {
      const vals = cols.map((c) => (c === adiar ? null : row[c]))
      if (t === 'usuarios') { const a = emailDe[row.id]; vals.push(clerkIdDe[row.id], a.email, a.invited_at) }
      await neon.query(`insert into public.${t} (${insCols.map((c) => `"${c}"`).join(',')}) values (${insCols.map((_, i) => `$${i + 1}`).join(',')})`, vals)
    }
    if (adiar) for (const row of rows) if (row[adiar]) await neon.query(`update public.${t} set "${adiar}"=$1 where id=$2`, [row[adiar], row.id])
    resumo[t] = rows.length
  }
  // decisao do usuario: anular midia perdida (blob:/pending: apontam para arquivos que nao existem mais).
  // data: URLs sao mantidas (ainda tem o conteudo). O Supabase de origem nao e alterado.
  const PERDIDA = `'^(blob:|pending:)'`
  const limpeza = [
    ['verificacao_fotos (linhas removidas)', `delete from public.verificacao_fotos where r2_key ~ ${PERDIDA}`],
    ['nc_fotos (linhas removidas)', `delete from public.nc_fotos where r2_key ~ ${PERDIDA}`],
    ['nao_conformidades.foto_reinspecao_url -> NULL', `update public.nao_conformidades set foto_reinspecao_url=null where foto_reinspecao_url ~ ${PERDIDA}`],
    ['verificacoes.assinatura_url -> NULL', `update public.verificacoes set assinatura_url=null where assinatura_url ~ ${PERDIDA}`],
  ]
  for (const [rotulo, sql] of limpeza) console.log('limpeza:', rotulo, (await neon.query(sql)).rowCount)
  for (const t of nomes) await neon.query(`ALTER TABLE public.${t} ENABLE TRIGGER USER`)
  await neon.query('COMMIT')
  console.log('carga concluida e commitada')
} catch (e) {
  await neon.query('ROLLBACK').catch(() => {})
  console.log('ERRO na carga, rollback feito:', e.message, e.detail ?? '', e.where ?? '')
  process.exitCode = 1
  await sb.end(); await neon.end(); process.exit(1)
}

// ---------- 3. verificacao ----------
let ok = true
for (const t of nomes) {
  let cols = (await colunasNeon(t)).filter((c) => !(t === 'usuarios' && EXTRA_USUARIOS.includes(c)))
  // colunas anuladas de proposito saem da comparacao; linhas removidas saem pelo filtro (nos dois lados)
  const OMITE = { nao_conformidades: ['foto_reinspecao_url'], verificacoes: ['assinatura_url'] }
  const ONDE = { verificacao_fotos: `r2_key !~ '^(blob:|pending:)'`, nc_fotos: `r2_key !~ '^(blob:|pending:)'` }
  cols = cols.filter((c) => !(OMITE[t] ?? []).includes(c))
  const proj = cols.map((c) => `"${c}"`).join(',')
  const q = `select count(*)::int n, coalesce(md5(string_agg(x::text, '|' order by x::text)),'') h from (select ${proj} from public.${t}${ONDE[t] ? ' where ' + ONDE[t] : ''}) x`
  const [a, b] = await Promise.all([sb.query(q), neon.query(q)])
  const igual = a.rows[0].n === b.rows[0].n && a.rows[0].h === b.rows[0].h
  if (!igual) ok = false
  console.log(igual ? 'OK  ' : 'DIFF', t.padEnd(42), a.rows[0].n, '/', b.rows[0].n)
}
console.log(ok ? 'TODAS AS TABELAS IDENTICAS' : 'HA DIFERENCAS')
await sb.end(); await neon.end()
