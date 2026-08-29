import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import EquipesClient from './EquipesClient';

export default async function EquipesPage() {
  const supabase = await createClient();
  const [{ data: equipes, error: equipesError }, { data: empresas }] = await Promise.all([
    supabase
      .from('equipes')
      .select('*, equipe_empresas!equipe_empresas_equipe_id_fkey(empresa_id)')
      .eq('ativo', true)
      .order('nome'),
    supabase.from('empresas').select('id, nome').eq('ativo', true).order('nome'),
  ]);

  return (
    <>
      <Header breadcrumbs={[{ label: 'Equipes' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
          <PageHeader
            title="Equipes"
            description="Frentes de trabalho responsáveis por corrigir não conformidades. Uma equipe só aparece na abertura de uma NC se estiver associada à obra."
          />
          <EquipesClient
            initialEquipes={(equipes as any[]) || []}
            empresas={empresas ?? []}
            loadError={equipesError ? 'Não foi possível carregar as equipes. Atualize a página ou tente novamente.' : undefined}
          />
        </div>
      </div>
    </>
  );
}
