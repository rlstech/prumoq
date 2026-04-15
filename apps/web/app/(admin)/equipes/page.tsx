import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import EquipesClient from './EquipesClient';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function EquipesPage() {
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
      <div className="max-w-6xl mx-auto space-y-6 mt-6 px-6 pb-12">
        <EquipesClient initialEquipes={equipes as any[] || []} />
      </div>
    </>
  );
}
