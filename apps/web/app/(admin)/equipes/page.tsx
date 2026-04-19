import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import EquipesClient from './EquipesClient';

export default async function EquipesPage() {
  const supabaseAdmin = createAdminClient();

  // Garante que o usuário está autenticado antes de buscar dados
  const serverClient = await createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();

  const { data: equipes } = user
    ? await supabaseAdmin
        .from('equipes')
        .select('*')
        .eq('ativo', true)
        .order('nome')
    : { data: [] };

  return (
    <>
      <Header breadcrumbs={[{ label: 'Equipes Cadastradas' }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
        <EquipesClient initialEquipes={equipes as any[] || []} />
        </div>
      </div>
    </>
  );
}
