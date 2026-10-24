'use server';

import { revalidatePath } from '@/lib/compat/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertObraInTenant, requireTenantRole } from '@/lib/auth/context';
import type { Database, Json } from '@prumoq/shared';

async function requireWork(obraId: string) {
  const context = await requireTenantRole(['admin', 'gestor']);
  await assertObraInTenant(obraId, context.clienteId);
  return context;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  const msg = (error as { message?: unknown } | null)?.message;
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object') {
    const inner = (msg as { message?: unknown }).message;
    if (typeof inner === 'string') return inner;
  }
  return fallback;
}

function refresh() {
  revalidatePath('/medicoes');
}

// ---------------------------------------------------------------- contratos

const contractSchema = z.object({
  contratoId: z.string().uuid().nullable(),
  obraId: z.string().uuid(),
  equipeId: z.string().uuid(),
  numero: z.string().trim().min(1, 'Informe o número do contrato'),
  objeto: z.string().trim().min(1, 'Informe o objeto do contrato'),
  valorContratado: z.number().nonnegative().nullable(),
  dataInicio: z.string().date(),
  dataFim: z.string().date().nullable(),
  observacao: z.string().nullable(),
});
export type ContractInput = z.infer<typeof contractSchema>;

export async function saveContract(raw: ContractInput) {
  try {
    const input = contractSchema.parse(raw);
    await requireWork(input.obraId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('salvar_contrato', {
      p_contrato_id: input.contratoId,
      p_obra_id: input.obraId,
      p_equipe_id: input.equipeId,
      p_numero: input.numero,
      p_objeto: input.objeto,
      p_valor_contratado: input.valorContratado,
      p_data_inicio: input.dataInicio,
      p_data_fim: input.dataFim,
      p_observacao: input.observacao,
    });
    if (error) throw error;
    refresh();
    return { success: true as const, id: data as string };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao salvar o contrato.') };
  }
}

export async function closeContract(id: string, obraId: string, motivo: string) {
  try {
    await requireWork(obraId);
    const supabase = await createClient();
    const { error } = await supabase.rpc('encerrar_contrato', { p_contrato_id: id, p_motivo: motivo });
    if (error) throw error;
    refresh();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao encerrar o contrato.') };
  }
}

export async function reopenContract(id: string, obraId: string) {
  try {
    await requireWork(obraId);
    const supabase = await createClient();
    const { error } = await supabase.rpc('reabrir_contrato', { p_contrato_id: id });
    if (error) throw error;
    refresh();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao reabrir o contrato.') };
  }
}

export type AvailableService = { id: string; servico: string; ambiente: string; ambienteId: string };

/** Serviços (FVS) da obra que ainda não têm medição configurada, por ambiente. */
export async function loadAvailableServices(obraId: string) {
  try {
    await requireWork(obraId);
    const supabase = await createClient();
    const { data: ambientes, error } = await supabase.from('ambientes').select('id,nome').eq('obra_id', obraId).order('nome');
    if (error) throw error;
    const ambienteIds = (ambientes ?? []).map(a => a.id);
    if (!ambienteIds.length) return { success: true as const, services: [] as AvailableService[] };
    const { data: fvs } = await supabase.from('fvs_planejadas').select('id,subservico,ambiente_id').in('ambiente_id', ambienteIds).order('subservico');
    const fvsIds = (fvs ?? []).map(f => f.id);
    const { data: configs } = fvsIds.length
      ? await supabase.from('fvs_medicao_configuracoes').select('fvs_planejada_id').in('fvs_planejada_id', fvsIds)
      : { data: [] };
    const configured = new Set((configs ?? []).map(c => c.fvs_planejada_id));
    const ambienteName = new Map((ambientes ?? []).map(a => [a.id, a.nome]));
    const services: AvailableService[] = (fvs ?? [])
      .filter(f => !configured.has(f.id))
      .map(f => ({ id: f.id, servico: f.subservico ?? 'Serviço', ambiente: ambienteName.get(f.ambiente_id) ?? '', ambienteId: f.ambiente_id }))
      .sort((a, b) => a.ambiente.localeCompare(b.ambiente, 'pt-BR') || a.servico.localeCompare(b.servico, 'pt-BR'));
    return { success: true as const, services };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao carregar os serviços.'), services: [] as AvailableService[] };
  }
}

const serviceSchema = z.object({
  fvsId: z.string().uuid(),
  metodo: z.enum(['quantidade', 'unidade_concluida']),
  unidade: z.string().trim().min(1),
  quantidade: z.number().positive(),
  preco: z.number().nonnegative().nullable(),
});
const servicesSchema = z.object({
  contratoId: z.string().uuid(),
  obraId: z.string().uuid(),
  dataInicio: z.string().date(),
  servicos: z.array(serviceSchema).min(1),
});
export type ContractServicesInput = z.infer<typeof servicesSchema>;

/** Adiciona serviços ao contrato (um por chamada; devolve os que falharam). */
export async function addContractServices(raw: ContractServicesInput) {
  try {
    const input = servicesSchema.parse(raw);
    await requireWork(input.obraId);
    const supabase = await createClient();
    const failures: { fvsId: string; error: string }[] = [];
    for (const s of input.servicos) {
      const unidadeConcluida = s.metodo === 'unidade_concluida';
      const { error } = await supabase.rpc('salvar_configuracao_medicao_contrato', {
        p_contrato_id: input.contratoId,
        p_fvs_id: s.fvsId,
        p_metodo: s.metodo,
        p_unidade: unidadeConcluida ? 'un' : s.unidade,
        p_quantidade_total: unidadeConcluida ? 1 : s.quantidade,
        p_preco_unitario: s.preco,
        p_permite_parciais: !unidadeConcluida,
        p_modelo_id: null,
        p_etapas: [] as unknown as Json,
        p_data_inicio: input.dataInicio,
      });
      if (error) failures.push({ fvsId: s.fvsId, error: errorMessage(error, 'Falha ao adicionar.') });
    }
    refresh();
    return { success: failures.length === 0, failures, added: input.servicos.length - failures.length };
  } catch (error) {
    return { success: false, failures: [], added: 0, error: errorMessage(error, 'Falha ao adicionar serviços.') };
  }
}

const amendmentItemSchema = z.union([
  z.object({
    fvs_id: z.string().uuid(),
    novo: z.literal(true),
    metodo: z.enum(['quantidade', 'unidade_concluida']),
    unidade: z.string().trim().min(1),
    quantidade: z.number().positive(),
    preco: z.number().nonnegative().nullable(),
  }),
  z.object({
    fvs_id: z.string().uuid(),
    quantidade: z.number().positive().optional(),
    preco: z.number().nonnegative().nullable().optional(),
  }),
]);
const amendmentSchema = z.object({
  contratoId: z.string().uuid(),
  obraId: z.string().uuid(),
  descricao: z.string().trim().min(3, 'Descreva o motivo do aditivo'),
  data: z.string().date(),
  itens: z.array(amendmentItemSchema).min(1, 'Altere ou inclua ao menos um item'),
});
export type AmendmentInput = z.infer<typeof amendmentSchema>;

/** Aditivo: vale na hora e fica registrado (número, motivo, autor e antes/depois de cada item). */
export async function applyAmendment(raw: AmendmentInput) {
  try {
    const input = amendmentSchema.parse(raw);
    await requireWork(input.obraId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('aplicar_aditivo_contrato', {
      p_contrato_id: input.contratoId,
      p_descricao: input.descricao,
      p_data: input.data,
      p_itens: input.itens as unknown as Json,
    });
    if (error) throw error;
    refresh();
    return { success: true as const, id: data as string };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? 'Dados inválidos.' };
    return { success: false as const, error: errorMessage(error, 'Falha ao registrar o aditivo.') };
  }
}

// ---------------------------------------------------------------- medições

export type Release = {
  id: string; vinculacaoId: string; verificacaoId: string; fvsId: string; service: string; stage: string | null;
  previous: number; current: number; quantity: number; unit: string; unitPrice: number | null;
};
export type Rework = { ncId: string; vinculacaoId: string; service: string; description: string; value: number; category: string | null };

/** Liberações (FVS conformes ainda não medidas) e retrabalho confirmado dos serviços deste contrato. */
export async function loadMeasurementOptions(contratoId: string, obraId: string) {
  try {
    await requireWork(obraId);
    const supabase = await createClient();
    const { data: links, error } = await supabase.from('vinculos_execucao_servico').select('*').eq('contrato_id', contratoId);
    if (error) throw error;
    const linkIds = (links ?? []).map(l => l.id);
    if (!linkIds.length) return { success: true as const, releases: [] as Release[], rework: [] as Rework[] };
    const { data: balances } = await supabase.from('vw_saldos_medicao_servico').select('*').in('vinculacao_id', linkIds).gt('disponivel', 0);
    const fvsIds = Array.from(new Set((links ?? []).map(l => l.fvs_planejada_id)));
    const stageIds = (links ?? []).map(l => l.etapa_id).filter((id): id is string => Boolean(id));
    const [{ data: configs }, { data: fvs }, { data: stages }, { data: advances }] = await Promise.all([
      supabase.from('fvs_medicao_configuracoes').select('*').in('fvs_planejada_id', fvsIds),
      supabase.from('fvs_planejadas').select('id,subservico').in('id', fvsIds),
      stageIds.length ? supabase.from('fvs_medicao_etapas').select('*').in('id', stageIds) : Promise.resolve({ data: [] }),
      supabase.from('avancos_aprovados_servico').select('*').in('vinculacao_id', linkIds).order('data_aprovacao'),
    ]);
    const advanceIds = (advances ?? []).map(a => a.id);
    const { data: used } = advanceIds.length
      ? await supabase.from('medicao_item_liberacoes').select('avanco_id,quantidade_utilizada').in('avanco_id', advanceIds).eq('ativa', true)
      : { data: [] };
    const usedByAdvance = new Map<string, number>();
    (used ?? []).forEach(u => usedByAdvance.set(u.avanco_id, (usedByAdvance.get(u.avanco_id) ?? 0) + Number(u.quantidade_utilizada)));
    // Saldo disponível por vínculo: já desconta o medido aprovado e os bloqueios por NC.
    const availableByLink = new Map<string, number>();
    (balances ?? []).forEach(b => { if (b.vinculacao_id) availableByLink.set(b.vinculacao_id, Number(b.disponivel ?? 0)); });

    const releases: Release[] = (advances ?? []).flatMap(a => {
      const remaining = availableByLink.get(a.vinculacao_id) ?? 0;
      if (remaining <= 0) return [];
      const raw = Number(a.aprovado_atual) - Number(a.aprovado_anterior) - (usedByAdvance.get(a.id) ?? 0);
      const available = Math.min(raw, remaining);
      availableByLink.set(a.vinculacao_id, remaining - Math.max(available, 0));
      if (available <= 0) return [];
      const link = (links ?? []).find(l => l.id === a.vinculacao_id);
      const config = (configs ?? []).find(c => c.fvs_planejada_id === link?.fvs_planejada_id);
      return [{
        id: a.id,
        vinculacaoId: a.vinculacao_id,
        verificacaoId: a.verificacao_id,
        fvsId: link?.fvs_planejada_id ?? '',
        service: (fvs ?? []).find(f => f.id === link?.fvs_planejada_id)?.subservico ?? 'Serviço',
        stage: (stages ?? []).find(s => s.id === link?.etapa_id)?.nome ?? null,
        previous: Number(a.aprovado_anterior),
        current: Number(a.aprovado_atual),
        quantity: available,
        unit: config?.unidade ?? a.unidade,
        unitPrice: config?.preco_unitario == null ? null : Number(config.preco_unitario),
      }];
    });

    const { data: verifications } = await supabase.from('verificacoes').select('id,fvs_planejada_id').in('fvs_planejada_id', fvsIds);
    const verificationIds = (verifications ?? []).map(v => v.id);
    const { data: ncs } = verificationIds.length
      ? await supabase.from('nao_conformidades').select('id,verificacao_id,descricao,valor_confirmado,categoria_financeira')
        .in('verificacao_id', verificationIds).eq('situacao_financeira', 'confirmado').gt('valor_confirmado', 0)
      : { data: [] };
    const rework: Rework[] = (ncs ?? []).flatMap(nc => {
      const verification = (verifications ?? []).find(v => v.id === nc.verificacao_id);
      const link = (links ?? []).find(l => l.fvs_planejada_id === verification?.fvs_planejada_id && l.status === 'ativo');
      if (!link) return [];
      return [{
        ncId: nc.id,
        vinculacaoId: link.id,
        service: (fvs ?? []).find(f => f.id === verification?.fvs_planejada_id)?.subservico ?? 'Serviço',
        description: nc.descricao,
        value: Number(nc.valor_confirmado ?? 0),
        category: nc.categoria_financeira,
      }];
    });
    return { success: true as const, releases, rework };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao carregar saldos.'), releases: [] as Release[], rework: [] as Rework[] };
  }
}

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  vinculacao_id: z.string().uuid(),
  verificacao_id: z.string().uuid().nullable(),
  nc_id: z.string().uuid().nullable(),
  tipo: z.enum(['avanco', 'retrabalho']),
  quantidade_anterior: z.number().nonnegative(),
  quantidade_atual: z.number().nonnegative(),
  quantidade_periodo: z.number().nonnegative(),
  quantidade_bloqueada: z.number().nonnegative(),
  unidade: z.string().min(1),
  preco_unitario: z.number().nonnegative().nullable(),
  valor_calculado: z.number().nonnegative(),
  liberacoes: z.array(z.object({ avanco_id: z.string().uuid(), quantidade: z.number().positive() })),
});
const draftSchema = z.object({
  contratoId: z.string().uuid(),
  obraId: z.string().uuid(),
  medicaoId: z.string().uuid().nullable(),
  referencia: z.string().trim().min(1),
  periodoInicio: z.string().date(),
  periodoFim: z.string().date(),
  dataMedicao: z.string().date(),
  observacao: z.string().nullable(),
  itens: z.array(itemSchema).min(1),
});
export type MeasurementDraftInput = z.infer<typeof draftSchema>;

export async function saveMeasurementDraft(raw: MeasurementDraftInput) {
  try {
    const input = draftSchema.parse(raw);
    await requireWork(input.obraId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('salvar_medicao_contrato', {
      p_contrato_id: input.contratoId,
      p_medicao_id: input.medicaoId,
      p_referencia: input.referencia,
      p_periodo_inicio: input.periodoInicio,
      p_periodo_fim: input.periodoFim,
      p_data_medicao: input.dataMedicao,
      p_observacao: input.observacao,
      p_itens: input.itens as unknown as Json,
    });
    if (error) throw error;
    refresh();
    return { success: true as const, id: data as string };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao salvar medição.') };
  }
}

export async function approveMeasurement(id: string, obraId: string) {
  try {
    await requireWork(obraId);
    const supabase = await createClient();
    const { error } = await supabase.rpc('aprovar_medicao_servico', { p_medicao_id: id });
    if (error) throw error;
    refresh();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao aprovar medição.') };
  }
}

export async function cancelMeasurement(id: string, obraId: string, motivo: string) {
  try {
    await requireWork(obraId);
    const supabase = await createClient();
    const { error } = await supabase.rpc('cancelar_medicao_servico', { p_medicao_id: id, p_motivo: motivo });
    if (error) throw error;
    refresh();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao cancelar medição.') };
  }
}

export async function discardMeasurement(id: string, obraId: string) {
  try {
    await requireWork(obraId);
    const supabase = await createClient();
    const { error } = await supabase.rpc('descartar_medicao_rascunho', { p_medicao_id: id });
    if (error) throw error;
    refresh();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, 'Falha ao descartar medição.') };
  }
}

// ---------------------------------------------------------------- detalhe da medição

type MeasurementRow = Database['public']['Tables']['medicoes_servico']['Row'];
type ItemRow = Database['public']['Tables']['medicao_servico_itens']['Row'];
type ReleaseRow = Database['public']['Tables']['medicao_item_liberacoes']['Row'];
type AdvanceRow = Database['public']['Tables']['avancos_aprovados_servico']['Row'];

export type MeasurementDetailItem = ItemRow & {
  servico: string;
  ambiente: string | null;
  etapa_nome: string | null;
  liberacoes: Array<{ avanco_id: string; quantidade_utilizada: number; aprovado_anterior: number; aprovado_atual: number; data_aprovacao: string | null }>;
  nc_descricao: string | null;
  nc_numero_ocorrencia: number | null;
};
export type MeasurementDetailBlocker = {
  nc_id: string; numero_ocorrencia: number; descricao: string; status: string;
  bloqueio_medicao: string | null; valor_bloqueado: number | null; situacao_financeira: string | null;
};
export type MeasurementDetail = {
  measurement: MeasurementRow;
  obra_nome: string;
  equipe_nome: string;
  equipe_terceirizada: boolean;
  contrato: { id: string; numero: string; objeto: string } | null;
  avaliacao: { id: string; status: string } | null;
  criado_por_nome: string | null;
  aprovado_por_nome: string | null;
  cancelado_por_nome: string | null;
  itens: MeasurementDetailItem[];
  bloqueios: MeasurementDetailBlocker[];
};

export async function getMeasurementDetail(medicaoId: string): Promise<{ success: true; detail: MeasurementDetail } | { success: false; error: string }> {
  try {
    const context = await requireTenantRole(['admin', 'gestor']);
    const supabase = await createClient();
    const { data: measurement, error: mError } = await supabase.from('medicoes_servico').select('*').eq('id', medicaoId).maybeSingle();
    if (mError || !measurement) throw new Error('Medição não encontrada.');
    await assertObraInTenant(measurement.obra_id, context.clienteId);

    const [{ data: obra }, { data: equipe }, { data: items }, { data: contrato }, { data: avaliacao }] = await Promise.all([
      supabase.from('obras').select('nome').eq('id', measurement.obra_id).maybeSingle(),
      supabase.from('equipes').select('nome,tipo').eq('id', measurement.equipe_id).maybeSingle(),
      supabase.from('medicao_servico_itens').select('*').eq('medicao_id', medicaoId).order('created_at'),
      measurement.contrato_id
        ? supabase.from('contratos').select('id,numero,objeto').eq('id', measurement.contrato_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('avaliacoes_empreiteiro').select('id,status').eq('medicao_id', medicaoId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const itemRows = (items ?? []) as ItemRow[];
    const linkIds = Array.from(new Set(itemRows.map(i => i.vinculacao_id)));
    const itemIds = itemRows.map(i => i.id);
    const ncIds = itemRows.map(i => i.nc_id).filter((id): id is string => Boolean(id));
    const userIds = [measurement.criado_por, measurement.aprovado_por, measurement.cancelado_por].filter((id): id is string => Boolean(id));

    const [{ data: links }, { data: releases }, { data: ncRows }, { data: users }] = await Promise.all([
      linkIds.length ? supabase.from('vinculos_execucao_servico').select('id,fvs_planejada_id').in('id', linkIds) : Promise.resolve({ data: [] }),
      itemIds.length ? supabase.from('medicao_item_liberacoes').select('*').in('medicao_item_id', itemIds).eq('ativa', true) : Promise.resolve({ data: [] }),
      ncIds.length ? supabase.from('nao_conformidades').select('id,descricao,numero_ocorrencia').in('id', ncIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from('usuarios').select('id,nome').in('id', userIds) : Promise.resolve({ data: [] }),
    ]);
    const releaseRows = (releases ?? []) as ReleaseRow[];
    const advanceIds = Array.from(new Set(releaseRows.map(r => r.avanco_id)));
    const { data: advanceRowsRaw } = advanceIds.length
      ? await supabase.from('avancos_aprovados_servico').select('*').in('id', advanceIds)
      : { data: [] };
    const advanceRows = (advanceRowsRaw ?? []) as AdvanceRow[];
    const advanceById = new Map(advanceRows.map(a => [a.id, a]));
    const fvsIds = Array.from(new Set((links ?? []).map(l => l.fvs_planejada_id)));
    const { data: fvsRows } = fvsIds.length
      ? await supabase.from('fvs_planejadas').select('id,subservico,ambiente_id').in('id', fvsIds)
      : { data: [] };
    const ambienteIds = Array.from(new Set((fvsRows ?? []).map(f => f.ambiente_id)));
    const { data: ambienteRows } = ambienteIds.length
      ? await supabase.from('ambientes').select('id,nome').in('id', ambienteIds)
      : { data: [] };
    const ambienteName = new Map((ambienteRows ?? []).map(a => [a.id, a.nome]));
    const fvsById = new Map((fvsRows ?? []).map(f => [f.id, f]));

    // Bloqueios por RNC ainda ativos nas verificações que liberaram esta medição.
    const verifIds = Array.from(new Set(advanceRows.map(a => a.verificacao_id)));
    const { data: blockerRows } = verifIds.length
      ? await supabase.from('nao_conformidades')
        .select('id,verificacao_id,numero_ocorrencia,descricao,status,bloqueio_medicao,valor_bloqueado,situacao_financeira')
        .in('verificacao_id', verifIds).in('status', ['aberta', 'em_correcao'])
      : { data: [] };
    const bloqueios = (blockerRows ?? []).filter(n => n.bloqueio_medicao && n.bloqueio_medicao !== 'nao');

    const stageIds = Array.from(new Set(itemRows.map(i => i.etapa_id).filter((id): id is string => Boolean(id))));
    const { data: stageRows } = stageIds.length ? await supabase.from('fvs_medicao_etapas').select('id,nome').in('id', stageIds) : { data: [] };
    const stageName = new Map((stageRows ?? []).map(s => [s.id, s.nome]));
    const linkById = new Map((links ?? []).map(l => [l.id, l]));
    const ncById = new Map((ncRows ?? []).map(n => [n.id, n]));
    const userById = new Map((users ?? []).map(u => [u.id, u.nome]));
    const releaseByItem = new Map<string, ReleaseRow[]>();
    for (const r of releaseRows) releaseByItem.set(r.medicao_item_id, [...(releaseByItem.get(r.medicao_item_id) ?? []), r]);

    const itens: MeasurementDetailItem[] = itemRows.map(item => {
      const fvs = fvsById.get(linkById.get(item.vinculacao_id)?.fvs_planejada_id ?? '');
      return {
        ...item,
        servico: fvs?.subservico ?? 'Serviço',
        ambiente: fvs ? ambienteName.get(fvs.ambiente_id) ?? null : null,
        etapa_nome: item.etapa_id ? stageName.get(item.etapa_id) ?? null : null,
        liberacoes: (releaseByItem.get(item.id) ?? []).map(r => {
          const a = advanceById.get(r.avanco_id);
          return {
            avanco_id: r.avanco_id,
            quantidade_utilizada: Number(r.quantidade_utilizada),
            aprovado_anterior: a ? Number(a.aprovado_anterior) : 0,
            aprovado_atual: a ? Number(a.aprovado_atual) : 0,
            data_aprovacao: a?.data_aprovacao ?? null,
          };
        }),
        nc_descricao: item.nc_id ? ncById.get(item.nc_id)?.descricao ?? null : null,
        nc_numero_ocorrencia: item.nc_id ? ncById.get(item.nc_id)?.numero_ocorrencia ?? null : null,
      };
    });

    return {
      success: true,
      detail: {
        measurement,
        obra_nome: obra?.nome ?? '',
        equipe_nome: equipe?.nome ?? '',
        equipe_terceirizada: equipe?.tipo === 'terceirizado',
        contrato: contrato ?? null,
        avaliacao: avaliacao ?? null,
        criado_por_nome: userById.get(measurement.criado_por) ?? null,
        aprovado_por_nome: measurement.aprovado_por ? userById.get(measurement.aprovado_por) ?? null : null,
        cancelado_por_nome: measurement.cancelado_por ? userById.get(measurement.cancelado_por) ?? null : null,
        itens,
        bloqueios: bloqueios.map(n => ({
          nc_id: n.id,
          numero_ocorrencia: Number(n.numero_ocorrencia),
          descricao: n.descricao,
          status: n.status,
          bloqueio_medicao: n.bloqueio_medicao,
          valor_bloqueado: n.valor_bloqueado == null ? null : Number(n.valor_bloqueado),
          situacao_financeira: n.situacao_financeira,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Falha ao carregar detalhe da medição.') };
  }
}
