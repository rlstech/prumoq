// Cria (ou localiza) o superadmin da plataforma: conta no Clerk + linha em `usuarios`.
// Uso: CLERK_SECRET_KEY=... DATABASE_URL=... SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... pnpm bootstrap:superadmin
// (variáveis pela linha de comando: segredos não ficam em arquivo)
// Precisa de DATABASE_URL (dono do banco): `usuarios` não tem policy que permita criar um superadmin pela API.
import pg from 'pg';

const clerkSecret = process.env.CLERK_SECRET_KEY;
const databaseUrl = process.env.DATABASE_URL;
const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME?.trim() || 'Administrador PrumoQ';

if (!clerkSecret || !databaseUrl || !email || !password || password.length < 12) {
  throw new Error('Informe CLERK_SECRET_KEY, DATABASE_URL, SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD (mínimo 12 caracteres).');
}

async function clerk(method, path, body) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${clerkSecret}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Clerk ${method} ${path} -> ${response.status} ${JSON.stringify(json.errors ?? json)}`);
  return json;
}

const existing = await clerk('GET', `/users?email_address=${encodeURIComponent(email)}`);
const [firstName, ...rest] = name.split(/\s+/);
const user = existing[0] ?? await clerk('POST', '/users', {
  email_address: [email],
  password,
  first_name: firstName,
  last_name: rest.join(' ') || undefined,
});

const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
try {
  const { rows } = await db.query('select perfil, cliente_id from public.usuarios where clerk_user_id = $1', [user.id]);
  if (rows[0] && (rows[0].perfil !== 'superadmin' || rows[0].cliente_id !== null)) {
    throw new Error('Este e-mail já pertence a um usuário operacional e não será promovido automaticamente.');
  }
  await db.query(
    `insert into public.usuarios (clerk_user_id, email, nome, perfil, cliente_id, ativo)
     values ($1, $2, $3, 'superadmin', null, true)
     on conflict (clerk_user_id) do update set email = excluded.email, nome = excluded.nome, ativo = true`,
    [user.id, email, name],
  );
} finally {
  await db.end();
}

console.info(`Superadmin configurado: ${email}`);
