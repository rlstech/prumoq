import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import UsuariosClient from './UsuariosClient';

export default async function UsuariosPage() {
  const supabase = await createClient();

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, nome, email, perfil, cargo, ativo, obras(nome)');

  return (
    <>
      <Header breadcrumbs={[{ label: 'Usuários' }]} />
      <div className="max-w-6xl mx-auto space-y-6 mt-6 px-6 pb-12">
        <UsuariosClient initialUsers={usuarios as any[] || []} />
      </div>
    </>
  );
}
