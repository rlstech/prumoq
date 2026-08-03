import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME?.trim() || 'Administrador PrumoQ';

if (!url || !serviceKey || !email || !password || password.length < 12) {
  throw new Error('Informe NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD (mínimo 12 caracteres).');
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nome: name },
});

let user = created?.user ?? null;
if (createError) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  user = listed.users.find(candidate => candidate.email?.toLowerCase() === email) ?? null;
  if (!user) throw createError;
}

const { data: existingProfile, error: profileReadError } = await admin
  .from('usuarios')
  .select('perfil, cliente_id')
  .eq('id', user.id)
  .maybeSingle();
if (profileReadError) throw profileReadError;
if (existingProfile && (existingProfile.perfil !== 'superadmin' || existingProfile.cliente_id !== null)) {
  throw new Error('Este e-mail já pertence a um usuário operacional e não será promovido automaticamente.');
}

const { error: profileError } = await admin.from('usuarios').upsert({
  id: user.id,
  cliente_id: null,
  nome: name,
  perfil: 'superadmin',
  ativo: true,
});
if (profileError) throw profileError;

console.info(`Superadmin configurado: ${email}`);
