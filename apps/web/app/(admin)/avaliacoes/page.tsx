import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/context';
import EvaluationsClient from './EvaluationsClient';
import { pageFromSearchParam, pageRange, pageSlice } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export default async function EvaluationsPage({ searchParams }: { searchParams?: { page?: string | string[] } }) {
  const supabase = await createClient();
  const context = await getAuthContext();
  const page = pageFromSearchParam(searchParams?.page);
  const { from, to } = pageRange(page);
  const [{ data: evaluations }, { data: metrics }, { data: models }, { data: revisions }, { data: criteria }, { data: works }, { data: teams }, { data: companies }, { data: users }] = await Promise.all([
    supabase.from('avaliacoes_empreiteiro').select('*').eq('cliente_id', context?.clienteId ?? '').order('data_avaliacao', { ascending: false }).range(from, to),
    // Tenant-wide, unpaginated: feeds the metric cards so they don't shift as the table above is paged.
    supabase.from('avaliacoes_empreiteiro').select('status,percentual').eq('cliente_id', context?.clienteId ?? ''),
    supabase.from('modelos_avaliacao_empreiteiro').select('*').order('nome'),
    supabase.from('modelo_avaliacao_empreiteiro_revisoes').select('*'),
    supabase.from('modelo_avaliacao_empreiteiro_criterios').select('*').order('ordem'),
    supabase.from('obras').select('id,nome,empresa_id').order('nome'),
    supabase.from('equipes').select('id,nome,tipo').eq('tipo', 'terceirizado').order('nome'),
    supabase.from('empresas').select('id,nome').eq('ativo', true).order('nome'),
    supabase.from('usuarios').select('id,nome'),
  ]);
  const evaluationPage = pageSlice(evaluations ?? []);
  return <><Header breadcrumbs={[{ label: 'Avaliações' }]} /><main className="prumo-page"><div className="prumo-page-inner"><EvaluationsClient evaluations={evaluationPage.rows} metrics={metrics ?? []} models={models ?? []} revisions={revisions ?? []} criteria={criteria ?? []} works={works ?? []} teams={teams ?? []} companies={companies ?? []} users={users ?? []} canManageModels={context?.perfil === 'admin'} canDecide={context?.perfil === 'admin' || context?.perfil === 'gestor'} page={page} hasNextPage={evaluationPage.hasNextPage} /></div></main></>;
}
