'use server';

import { revalidatePath } from 'next/cache';
import { assertObraInTenant, requireTenantRole } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@prumoq/shared';
import { z } from 'zod';

type FinancialSituation = Database['public']['Enums']['situacao_impacto_financeiro_nc'];
type MeasurementBlock = Database['public']['Enums']['bloqueio_medicao_nc'];
type FinancialResponsible = Database['public']['Enums']['responsavel_financeiro_nc'];
type FinancialCategory = Database['public']['Enums']['categoria_impacto_financeiro_nc'];

const financialSchema=z.object({
  situacao:z.enum(['sem_impacto','em_avaliacao','estimado','confirmado']) satisfies z.ZodType<FinancialSituation>,
  bloqueio:z.enum(['nao','total','parcial']) satisfies z.ZodType<MeasurementBlock>,
  justificativaSemImpacto:z.string().trim().min(1).nullable(),
  responsavelAvaliacaoId:z.string().uuid().nullable(),
  prazoAvaliacao:z.string().date().nullable(),
  valorEstimado:z.number().positive().nullable(),
  valorConfirmado:z.number().nonnegative().nullable(),
  responsavelFinanceiro:z.enum(['construtora','empreiteiro','fornecedor','projetista','em_analise']).nullable() satisfies z.ZodType<FinancialResponsible|null>,
  categoriaFinanceira:z.enum(['mao_obra_retrabalho','perda_material','equipamento_mobilizacao','atraso','glosa_retencao','desconto_empreiteiro','outro']).nullable() satisfies z.ZodType<FinancialCategory|null>,
  valorBloqueado:z.number().positive().nullable(),
  observacao:z.string().trim().max(2000).nullable(),
  documento:z.string().trim().max(500).nullable(),
}).superRefine((value,context)=>{
  if(value.situacao==='sem_impacto'&&(!value.justificativaSemImpacto||value.valorConfirmado!==0))context.addIssue({code:z.ZodIssueCode.custom,message:'Sem impacto exige justificativa e valor zero.'});
  if(value.situacao==='em_avaliacao'&&(!value.responsavelAvaliacaoId||!value.prazoAvaliacao))context.addIssue({code:z.ZodIssueCode.custom,message:'Impacto em avaliação exige responsável e prazo.'});
  if(value.situacao==='estimado'&&(!value.valorEstimado||!value.responsavelFinanceiro||!value.categoriaFinanceira))context.addIssue({code:z.ZodIssueCode.custom,message:'Impacto estimado exige valor, responsável e categoria.'});
  if(value.situacao==='confirmado'&&(!(value.valorConfirmado&&value.valorConfirmado>0)||!value.responsavelFinanceiro||!value.categoriaFinanceira))context.addIssue({code:z.ZodIssueCode.custom,message:'Impacto confirmado exige valor, responsável e categoria.'});
  if(value.bloqueio==='parcial'&&!(value.valorBloqueado&&value.valorBloqueado>0))context.addIssue({code:z.ZodIssueCode.custom,message:'Bloqueio parcial exige valor bloqueado positivo.'});
});
export type NcFinancialInput=z.input<typeof financialSchema>;

export async function updateNcFinancialImpact(ncId: string, input: NcFinancialInput) {
  try {
    const validated=financialSchema.parse(input);
    const context = await requireTenantRole(['admin', 'gestor']);
    const supabase = await createClient();
    const { data: nc, error: ncError } = await supabase
      .from('nao_conformidades')
      .select('verificacao_id')
      .eq('id', ncId)
      .maybeSingle();
    if (ncError || !nc) throw new Error('Não conformidade não encontrada.');
    const { data: verification } = await supabase
      .from('verificacoes')
      .select('fvs_planejada_id')
      .eq('id', nc.verificacao_id)
      .maybeSingle();
    const { data: planned } = verification
      ? await supabase.from('fvs_planejadas').select('ambiente_id').eq('id', verification.fvs_planejada_id).maybeSingle()
      : { data: null };
    const { data: environment } = planned
      ? await supabase.from('ambientes').select('obra_id').eq('id', planned.ambiente_id).maybeSingle()
      : { data: null };
    if (!environment) throw new Error('Não foi possível identificar a obra da não conformidade.');
    await assertObraInTenant(environment.obra_id, context.clienteId);

    const { error } = await (supabase.rpc as any)('atualizar_impacto_financeiro_nc', {
      p_nc_id: ncId, p_situacao: validated.situacao, p_bloqueio: validated.bloqueio,
      p_justificativa: validated.justificativaSemImpacto, p_responsavel_avaliacao: validated.responsavelAvaliacaoId,
      p_prazo: validated.prazoAvaliacao, p_valor_estimado: validated.valorEstimado, p_valor_confirmado: validated.valorConfirmado,
      p_responsavel_financeiro: validated.responsavelFinanceiro, p_categoria: validated.categoriaFinanceira,
      p_valor_bloqueado: validated.valorBloqueado,
      p_observacao: validated.observacao, p_documento: validated.documento,
    });
    if (error) throw error;
    revalidatePath(`/nc/${ncId}`);
    revalidatePath('/medicoes');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Não foi possível atualizar o impacto financeiro.' };
  }
}
