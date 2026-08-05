import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import MeasurementServiceClient from './MeasurementServiceClient';

export const dynamic = 'force-dynamic';

export default async function MeasurementServicePage({ params }: { params: Promise<{ id: string; ambId: string; fvsId: string }> }) {
  const { id: obraId, ambId, fvsId } = await params;
  const supabase = await createClient();
  const [{ data: obra }, { data: ambiente }, { data: fvs }] = await Promise.all([
    supabase.from('obras').select('id,nome,empresa_id,controle_medicoes_efetivo').eq('id', obraId).maybeSingle(),
    supabase.from('ambientes').select('id,nome,obra_id').eq('id', ambId).maybeSingle(),
    supabase.from('fvs_planejadas').select('id,ambiente_id,subservico').eq('id', fvsId).maybeSingle(),
  ]);
  if (!obra || !ambiente || !fvs || ambiente.obra_id !== obraId || fvs.ambiente_id !== ambId) notFound();

  const [{ data: config }, { data: links }, { data: balances }, { data: teamLinks }, { data: models }] = await Promise.all([
    supabase.from('fvs_medicao_configuracoes').select('*').eq('fvs_planejada_id', fvsId).maybeSingle(),
    supabase.from('vinculos_execucao_servico').select('*').eq('fvs_planejada_id', fvsId).order('created_at'),
    supabase.from('vw_saldos_medicao_servico').select('*').eq('fvs_planejada_id', fvsId),
    supabase.from('obra_equipes').select('equipe_id').eq('obra_id', obraId),
    supabase.from('modelos_etapas_medicao').select('*').eq('empresa_id', obra.empresa_id).eq('ativo', true).order('nome'),
  ]);
  const linkedTeamIds = (teamLinks ?? []).map(link => link.equipe_id);
  const { data: teams } = linkedTeamIds.length
    ? await supabase.from('equipes').select('id,nome,tipo').in('id', linkedTeamIds).eq('ativo', true).order('nome')
    : { data: [] };
  const configId = config?.id;
  const linkIds = (links ?? []).map(link => link.id);
  const modelIds = (models ?? []).map(model => model.id);
  const [{ data: stages }, { data: advances }, { data: modelItems }, { data: measurementItems }] = await Promise.all([
    configId ? supabase.from('fvs_medicao_etapas').select('*').eq('configuracao_id', configId).order('ordem') : Promise.resolve({ data: [] }),
    linkIds.length ? supabase.from('avancos_aprovados_servico').select('*').in('vinculacao_id', linkIds).order('data_aprovacao', { ascending: false }) : Promise.resolve({ data: [] }),
    modelIds.length ? supabase.from('modelo_etapas_medicao_itens').select('*').in('modelo_id', modelIds).order('ordem') : Promise.resolve({ data: [] }),
    linkIds.length ? supabase.from('medicao_servico_itens').select('*').in('vinculacao_id', linkIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const measurementIds = (measurementItems ?? []).map(item => item.medicao_id);
  const { data: measurements } = measurementIds.length
    ? await supabase.from('medicoes_servico').select('*').in('id', measurementIds)
    : { data: [] };

  return <>
    <Header breadcrumbs={[{ label: 'Obras', href: '/obras' }, { label: obra.nome, href: `/obras/${obraId}` }, { label: ambiente.nome, href: `/obras/${obraId}/ambiente/${ambId}` }, { label: 'Medição' }]} />
    <main className="prumo-page"><div className="prumo-page-inner">
      <MeasurementServiceClient
        obraId={obraId}
        fvsId={fvsId}
        title={fvs.subservico ?? 'Serviço'}
        enabled={obra.controle_medicoes_efetivo}
        config={config}
        stages={stages ?? []}
        links={links ?? []}
        balances={balances ?? []}
        teams={teams ?? []}
        models={(models ?? []).map(model => ({ ...model, items: (modelItems ?? []).filter(item => item.modelo_id === model.id) }))}
        advances={advances ?? []}
        measurementItems={measurementItems ?? []}
        measurements={measurements ?? []}
      />
    </div></main>
  </>;
}
