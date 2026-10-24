import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';

type Client = SupabaseClient<Database>;

export type MeasurementReportItem = {
  id: string;
  tipo: 'avanco' | 'retrabalho';
  servico: string;
  ambiente: string | null;
  etapa: string | null;
  anterior: number;
  atual: number;
  periodo: number;
  unidade: string;
  preco: number | null;
  valor: number;
  nc: string | null;
};
export type MeasurementReportMeasurement = {
  id: string;
  referencia: string;
  periodoInicio: string;
  periodoFim: string;
  data: string;
  aprovadoEm: string | null;
  aprovadoPor: string | null;
  observacao: string | null;
  valor: number;
  acumulado: number;
  itens: MeasurementReportItem[];
};
export type MeasurementReportContract = {
  id: string;
  numero: string;
  objeto: string;
  obra: string;
  equipe: string;
  inicio: string;
  fim: string | null;
  status: string;
  contratado: number;
  medido: number;
  aditivos: { numero: number; data: string; descricao: string; valorAnterior: number; valorNovo: number }[];
  medicoes: MeasurementReportMeasurement[];
};
export type MeasurementReport = {
  escopo: string;
  /** Uma medição só: sai como boletim, com espaço para assinaturas. */
  boletim: boolean;
  emitidoEm: string;
  contratos: MeasurementReportContract[];
};

export type MeasurementReportFilter = { obra?: string | null; contrato?: string | null; medicao?: string | null };

/** Medições APROVADAS, agrupadas por contrato. Rascunhos e canceladas ficam fora. */
export async function loadMeasurementReport(supabase: Client, filter: MeasurementReportFilter): Promise<MeasurementReport | null> {
  let contractId = filter.contrato ?? null;
  if (filter.medicao) {
    const { data } = await supabase.from('medicoes_servico').select('contrato_id').eq('id', filter.medicao).maybeSingle();
    if (!data?.contrato_id) return null;
    contractId = data.contrato_id;
  }

  let query = supabase.from('contratos').select('*').order('numero');
  if (contractId) query = query.eq('id', contractId);
  else if (filter.obra) query = query.eq('obra_id', filter.obra);
  const { data: contracts } = await query;
  if (!contracts?.length) return contractId || filter.obra ? null : { escopo: 'Todas as obras', boletim: false, emitidoEm: new Date().toISOString(), contratos: [] };

  const contractIds = contracts.map(c => c.id);
  const obraIds = Array.from(new Set(contracts.map(c => c.obra_id)));
  const equipeIds = Array.from(new Set(contracts.map(c => c.equipe_id)));
  const [{ data: summaries }, { data: obras }, { data: equipes }, { data: measurements }, { data: amendments }] = await Promise.all([
    supabase.from('vw_resumo_contratos').select('contrato_id,valor_referencia').in('contrato_id', contractIds),
    supabase.from('obras').select('id,nome').in('id', obraIds),
    supabase.from('equipes').select('id,nome').in('id', equipeIds),
    supabase.from('medicoes_servico').select('*').in('contrato_id', contractIds).eq('status', 'aprovada')
      .order('data_medicao').order('aprovado_em'),
    supabase.from('contrato_aditivos').select('contrato_id,numero,data,descricao,valor_anterior,valor_novo').in('contrato_id', contractIds).order('numero'),
  ]);

  const measurementIds = (measurements ?? []).map(m => m.id);
  const { data: items } = measurementIds.length
    ? await supabase.from('medicao_servico_itens').select('*').in('medicao_id', measurementIds).order('created_at')
    : { data: [] };
  const linkIds = Array.from(new Set((items ?? []).map(i => i.vinculacao_id)));
  const stageIds = Array.from(new Set((items ?? []).map(i => i.etapa_id).filter((id): id is string => Boolean(id))));
  const ncIds = (items ?? []).map(i => i.nc_id).filter((id): id is string => Boolean(id));
  const userIds = Array.from(new Set((measurements ?? []).map(m => m.aprovado_por).filter((id): id is string => Boolean(id))));
  const [{ data: links }, { data: stages }, { data: ncs }, { data: users }] = await Promise.all([
    linkIds.length ? supabase.from('vinculos_execucao_servico').select('id,fvs_planejada_id').in('id', linkIds) : Promise.resolve({ data: [] }),
    stageIds.length ? supabase.from('fvs_medicao_etapas').select('id,nome').in('id', stageIds) : Promise.resolve({ data: [] }),
    ncIds.length ? supabase.from('nao_conformidades').select('id,numero_ocorrencia,descricao').in('id', ncIds) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from('usuarios').select('id,nome').in('id', userIds) : Promise.resolve({ data: [] }),
  ]);
  const fvsIds = Array.from(new Set((links ?? []).map(l => l.fvs_planejada_id)));
  const { data: fvs } = fvsIds.length ? await supabase.from('fvs_planejadas').select('id,subservico,ambiente_id').in('id', fvsIds) : { data: [] };
  const ambienteIds = Array.from(new Set((fvs ?? []).map(f => f.ambiente_id)));
  const { data: ambientes } = ambienteIds.length ? await supabase.from('ambientes').select('id,nome').in('id', ambienteIds) : { data: [] };

  const linkFvs = new Map((links ?? []).map(l => [l.id, l.fvs_planejada_id]));
  const fvsById = new Map((fvs ?? []).map(f => [f.id, f]));
  const ambienteName = new Map((ambientes ?? []).map(a => [a.id, a.nome]));
  const stageName = new Map((stages ?? []).map(s => [s.id, s.nome]));
  const ncById = new Map((ncs ?? []).map(n => [n.id, n]));
  const userName = new Map((users ?? []).map(u => [u.id, u.nome]));
  const obraName = new Map((obras ?? []).map(o => [o.id, o.nome]));
  const equipeName = new Map((equipes ?? []).map(e => [e.id, e.nome]));
  const reference = new Map((summaries ?? []).map(s => [s.contrato_id, Number(s.valor_referencia ?? 0)]));

  const itemsByMeasurement = new Map<string, MeasurementReportItem[]>();
  for (const i of items ?? []) {
    const f = fvsById.get(linkFvs.get(i.vinculacao_id) ?? '');
    const nc = i.nc_id ? ncById.get(i.nc_id) : null;
    const list = itemsByMeasurement.get(i.medicao_id) ?? [];
    list.push({
      id: i.id,
      tipo: i.tipo,
      servico: f?.subservico ?? 'Serviço',
      ambiente: f ? ambienteName.get(f.ambiente_id) ?? null : null,
      etapa: i.etapa_id ? stageName.get(i.etapa_id) ?? null : null,
      anterior: Number(i.quantidade_anterior),
      atual: Number(i.quantidade_atual),
      periodo: Number(i.quantidade_periodo),
      unidade: i.unidade,
      preco: i.preco_unitario == null ? null : Number(i.preco_unitario),
      valor: Number(i.valor_calculado),
      nc: nc ? `NC #${nc.numero_ocorrencia} · ${nc.descricao}` : null,
    });
    itemsByMeasurement.set(i.medicao_id, list);
  }

  const result: MeasurementReportContract[] = contracts.map(c => {
    let acumulado = 0;
    const all = (measurements ?? []).filter(m => m.contrato_id === c.id)
      .sort((x, y) => x.data_medicao.localeCompare(y.data_medicao) || (x.aprovado_em ?? '').localeCompare(y.aprovado_em ?? ''))
      .map(m => {
      const itens = itemsByMeasurement.get(m.id) ?? [];
      const valor = itens.reduce((s, i) => s + i.valor, 0);
      acumulado += valor;
      return {
        id: m.id,
        referencia: m.referencia,
        periodoInicio: m.periodo_inicio,
        periodoFim: m.periodo_fim,
        data: m.data_medicao,
        aprovadoEm: m.aprovado_em,
        aprovadoPor: m.aprovado_por ? userName.get(m.aprovado_por) ?? null : null,
        observacao: m.observacao,
        valor,
        acumulado,
        itens,
      };
    });
    return {
      id: c.id,
      numero: c.numero,
      objeto: c.objeto,
      obra: obraName.get(c.obra_id) ?? '',
      equipe: equipeName.get(c.equipe_id) ?? '',
      inicio: c.data_inicio,
      fim: c.data_fim,
      status: c.status,
      contratado: reference.get(c.id) ?? 0,
      medido: acumulado,
      aditivos: (amendments ?? []).filter(a => a.contrato_id === c.id).map(a => ({
        numero: a.numero, data: a.data, descricao: a.descricao, valorAnterior: Number(a.valor_anterior), valorNovo: Number(a.valor_novo),
      })),
      medicoes: filter.medicao ? all.filter(m => m.id === filter.medicao) : all,
    };
  });

  const only = result[0];
  const escopo = filter.medicao
    ? `Medição ${only?.medicoes[0]?.referencia ?? ''} · contrato ${only?.numero ?? ''}`
    : contractId
      ? `Contrato ${only?.numero ?? ''} · ${only?.obra ?? ''}`
      : filter.obra
        ? `Obra ${obraName.get(filter.obra) ?? ''} · todos os contratos`
        : 'Todas as obras e contratos';
  return { escopo, boletim: Boolean(filter.medicao), emitidoEm: new Date().toISOString(), contratos: result };
}
