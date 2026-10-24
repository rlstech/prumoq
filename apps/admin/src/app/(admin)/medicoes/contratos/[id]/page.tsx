import Header from '@/components/layout/Header';
import { notFound } from '@/lib/compat/navigation';
import { createClient } from '@/lib/supabase/server';
import ContractDetailClient, { type ServiceRow } from './ContractDetailClient';

export const dynamic = 'force-dynamic';

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contract } = await supabase.from('contratos').select('*').eq('id', id).maybeSingle();
  if (!contract) notFound();

  const [{ data: summary }, { data: works }, { data: teams }, { data: workTeams }, { data: measurements }, { data: links }] = await Promise.all([
    supabase.from('vw_resumo_contratos').select('*').eq('contrato_id', id).maybeSingle(),
    supabase.from('obras').select('id,nome,controle_medicoes_efetivo').order('nome'),
    supabase.from('equipes').select('id,nome').order('nome'),
    supabase.from('obra_equipes').select('obra_id,equipe_id'),
    supabase.from('medicoes_servico').select('*').eq('contrato_id', id).order('data_medicao', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('vinculos_execucao_servico').select('*').eq('contrato_id', id).order('created_at'),
  ]);

  const measurementIds = (measurements ?? []).map(m => m.id);
  const linkIds = (links ?? []).map(l => l.id);
  const fvsIds = Array.from(new Set((links ?? []).map(l => l.fvs_planejada_id)));
  const [{ data: items }, { data: balances }, { data: fvs }, { data: configs }] = await Promise.all([
    measurementIds.length
      ? supabase.from('medicao_servico_itens').select('medicao_id,valor_calculado,tipo').in('medicao_id', measurementIds)
      : Promise.resolve({ data: [] }),
    linkIds.length ? supabase.from('vw_saldos_medicao_servico').select('*').in('vinculacao_id', linkIds) : Promise.resolve({ data: [] }),
    fvsIds.length ? supabase.from('fvs_planejadas').select('id,subservico,ambiente_id').in('id', fvsIds) : Promise.resolve({ data: [] }),
    fvsIds.length ? supabase.from('fvs_medicao_configuracoes').select('fvs_planejada_id,metodo,unidade,quantidade_total,preco_unitario').in('fvs_planejada_id', fvsIds) : Promise.resolve({ data: [] }),
  ]);
  const ambienteIds = Array.from(new Set((fvs ?? []).map(f => f.ambiente_id)));
  const { data: ambientes } = ambienteIds.length ? await supabase.from('ambientes').select('id,nome').in('id', ambienteIds) : { data: [] };

  // Uma linha por serviço (FVS), somando etapas e trocas de empreiteiro dentro do contrato.
  const ambienteName = new Map((ambientes ?? []).map(a => [a.id, a.nome]));
  const services = new Map<string, ServiceRow>();
  for (const link of links ?? []) {
    const f = (fvs ?? []).find(x => x.id === link.fvs_planejada_id);
    const cfg = (configs ?? []).find(c => c.fvs_planejada_id === link.fvs_planejada_id);
    const b = (balances ?? []).find(x => x.vinculacao_id === link.id);
    const price = cfg?.preco_unitario == null ? null : Number(cfg.preco_unitario);
    const scope = link.status === 'ativo' ? Number(link.escopo_atribuido) : Number(link.aprovado_congelado);
    const row = services.get(link.fvs_planejada_id) ?? {
      fvsId: link.fvs_planejada_id,
      ambienteId: f?.ambiente_id ?? '',
      ambiente: f ? ambienteName.get(f.ambiente_id) ?? '' : '',
      servico: f?.subservico ?? 'Serviço',
      unidade: cfg?.unidade ?? '',
      metodo: cfg?.metodo ?? 'quantidade',
      preco: price,
      previsto: 0, aprovado: 0, medido: 0, liberado: 0, bloqueado: 0,
      valorLiberado: 0, valorBloqueado: 0, valorMedido: 0,
    };
    row.previsto += scope;
    row.aprovado += Number(b?.aprovado ?? 0);
    row.medido += Number(b?.medido ?? 0);
    row.liberado += Number(b?.disponivel ?? 0);
    row.bloqueado += Number(b?.bloqueado ?? 0);
    row.valorLiberado += Number(b?.valor_disponivel ?? 0);
    row.valorBloqueado += Number(b?.valor_bloqueado ?? 0);
    row.valorMedido += Number(b?.valor_medido ?? 0);
    services.set(link.fvs_planejada_id, row);
  }

  const obraNome = (works ?? []).find(w => w.id === contract.obra_id)?.nome ?? '';
  const equipeNome = (teams ?? []).find(t => t.id === contract.equipe_id)?.nome ?? '';

  return (
    <>
      <Header breadcrumbs={[{ label: 'Contratos e medições', href: '/medicoes' }, { label: contract.numero }]} />
      <main className="prumo-page">
        <div className="prumo-page-inner">
          <ContractDetailClient
            contract={contract}
            summary={summary}
            obraNome={obraNome}
            equipeNome={equipeNome}
            measurements={measurements ?? []}
            itemTotals={items ?? []}
            services={Array.from(services.values()).sort((a, b) => a.ambiente.localeCompare(b.ambiente, 'pt-BR') || a.servico.localeCompare(b.servico, 'pt-BR'))}
            works={works ?? []}
            teams={teams ?? []}
            workTeams={workTeams ?? []}
          />
        </div>
      </main>
    </>
  );
}
