import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import UsuariosClient from './UsuariosClient';
import { requireTenantRole } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';

export default async function UsuariosPage() {
  const context = await requireTenantRole(['admin']);
  const supabase = await createClient();
  const [{ data: profiles }, { data: obras }, { data: links }] = await Promise.all([
    supabase.from('usuarios').select('id, nome, email, cargo, perfil, ativo, created_at').eq('cliente_id', context.clienteId).order('nome'),
    supabase.from('obras').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('obra_usuarios').select('usuario_id, obras!obra_usuarios_obra_id_fkey(id, nome)').eq('cliente_id', context.clienteId).eq('ativo', true),
  ]);

  const linksByUser = new Map<string, Array<{ id: string; nome: string }>>();
  for (const link of (links as any[] | null) ?? []) {
    const obra = Array.isArray(link.obras) ? link.obras[0] : link.obras;
    if (!obra) continue;
    linksByUser.set(link.usuario_id, [...(linksByUser.get(link.usuario_id) ?? []), obra]);
  }
  const users = (profiles ?? []).map(profile => ({
    ...profile,
    email: profile.email ?? '',
    obras_acesso: linksByUser.get(profile.id) ?? [],
    ultimo_acesso: null,
  }));

  return (
    <>
      <Header breadcrumbs={[{ label: 'Pessoas' }]} />
      <div className="prumo-page"><div className="prumo-page-inner">
        <PageHeader
          title="Pessoas"
          description="Usuários do painel e o escopo de obras que cada um enxerga. O perfil inspetor usa apenas o aplicativo de campo."
        />
        <UsuariosClient initialUsers={users} availableObras={obras ?? []} />
      </div></div>
    </>
  );
}
