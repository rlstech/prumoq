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
      <div className="prumo-page">
        <div className="prumo-page-inner">
        <UsuariosClient initialUsers={usuarios as any[] || []} availableObras={obras as any[] || []} />
        </div>
      </div>
    </>
  );
}
