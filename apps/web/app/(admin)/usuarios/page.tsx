import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import UsuariosClient from './UsuariosClient';

export default async function UsuariosPage() {
  const supabase = await createClient();

  const { data: usuarios } = await (supabase.rpc as any)('get_usuarios_com_obras');
  const { data: obras } = await supabase.from('obras' as any).select('id, nome').eq('ativo', true);

  return (
    <>
      <Header breadcrumbs={[{ label: 'Usuários' }]} />
      <div className="max-w-6xl mx-auto space-y-6 mt-6 px-6 pb-12">
        <UsuariosClient initialUsers={usuarios as any[] || []} availableObras={obras as any[] || []} />
      </div>
    </>
  );
}
