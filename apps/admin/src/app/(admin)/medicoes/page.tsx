import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import ContractsClient from './ContractsClient';

export const dynamic = 'force-dynamic';

export default async function ContractsPage() {
  const supabase = await createClient();
  const [{ data: contracts }, { data: summaries }, { data: works }, { data: teams }, { data: workTeams }] = await Promise.all([
    supabase.from('contratos').select('*').order('created_at', { ascending: false }),
    supabase.from('vw_resumo_contratos').select('*'),
    supabase.from('obras').select('id,nome,controle_medicoes_efetivo').order('nome'),
    supabase.from('equipes').select('id,nome').order('nome'),
    supabase.from('obra_equipes').select('obra_id,equipe_id'),
  ]);

  return (
    <>
      <Header breadcrumbs={[{ label: 'Contratos e medições' }]} />
      <main className="prumo-page">
        <div className="prumo-page-inner">
          <ContractsClient
            contracts={contracts ?? []}
            summaries={summaries ?? []}
            works={works ?? []}
            teams={teams ?? []}
            workTeams={workTeams ?? []}
          />
        </div>
      </main>
    </>
  );
}
