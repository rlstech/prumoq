import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import EquipesClient from './EquipesClient';

export default async function EquipesPage() {
  const supabase = await createClient();

  const { data: equipes } = await supabase
    .from('equipes')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  return (
    <>
      <Header breadcrumbs={[{ label: 'Equipes Cadastradas' }]} />
      <div className="max-w-6xl mx-auto space-y-6 mt-6 px-6 pb-12">
        <EquipesClient initialEquipes={equipes as any[] || []} />
      </div>
    </>
  );
}
