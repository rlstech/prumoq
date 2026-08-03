import Header from '@/components/layout/Header';
import UsuariosClient from './UsuariosClient';
import { requireTenantRole } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function UsuariosPage() {
  const context = await requireTenantRole(['admin']);
  const supabase = await createClient();
  const [{ data: profiles }, { data: obras }, { data: links }] = await Promise.all([
    supabase.from('usuarios').select('id, nome, cargo, perfil, ativo, created_at').eq('cliente_id', context.clienteId).order('nome'),
    supabase.from('obras').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('obra_usuarios').select('usuario_id, obras!obra_usuarios_obra_id_fkey(id, nome)').eq('cliente_id', context.clienteId).eq('ativo', true),
  ]);

  const admin = createAdminClient();
  const { data: authPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map(authPage.users.map(user => [user.id, user.email ?? '']));
  const linksByUser = new Map<string, Array<{ id: string; nome: string }>>();
  for (const link of (links as any[] | null) ?? []) {
    const obra = Array.isArray(link.obras) ? link.obras[0] : link.obras;
    if (!obra) continue;
    linksByUser.set(link.usuario_id, [...(linksByUser.get(link.usuario_id) ?? []), obra]);
  }
  const users = (profiles ?? []).map(profile => ({
    ...profile,
    email: emailById.get(profile.id) ?? '',
    obras_acesso: linksByUser.get(profile.id) ?? [],
    ultimo_acesso: null,
  }));

  return (
    <>
      <Header breadcrumbs={[{ label: 'Usuários' }]} />
      <div className="prumo-page"><div className="prumo-page-inner">
        <UsuariosClient initialUsers={users} availableObras={obras ?? []} />
      </div></div>
    </>
  );
}
