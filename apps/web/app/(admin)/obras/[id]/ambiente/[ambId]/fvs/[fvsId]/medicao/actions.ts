'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertObraInTenant, requireTenantRole } from '@/lib/auth/context';
import type { Database, Json } from '@prumoq/shared';

const stageSchema = z.object({
  ordem: z.number().int().positive(),
  nome: z.string().trim().min(1),
  peso_percentual: z.number().positive().max(100),
  permite_avanco_parcial: z.boolean(),
  ativo: z.boolean(),
});

const configSchema = z.object({
  obraId: z.string().uuid(),
  fvsId: z.string().uuid(),
  metodo: z.enum(['quantidade', 'unidade_concluida', 'etapas_ponderadas']),
  unidade: z.string().trim().min(1),
  quantidadeTotal: z.number().positive(),
  precoUnitario: z.number().nonnegative().nullable(),
  permiteParciais: z.boolean(),
  modeloId: z.string().uuid().nullable(),
  etapas: z.array(stageSchema),
  equipeInicialId: z.string().uuid(),
  dataInicio: z.string().date(),
});

export type MeasurementConfigInput = z.infer<typeof configSchema>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export async function saveMeasurementConfig(raw: MeasurementConfigInput) {
  try {
    const input = configSchema.parse(raw);
    const context = await requireTenantRole(['admin', 'gestor']);
    await assertObraInTenant(input.obraId, context.clienteId);
    const supabase = await createClient();
    const { error } = await supabase.rpc('salvar_configuracao_medicao_fvs', {
      p_fvs_id: input.fvsId,
      p_metodo: input.metodo,
      p_unidade: input.unidade,
      p_quantidade_total: input.quantidadeTotal,
      p_preco_unitario: input.precoUnitario,
      p_permite_parciais: input.permiteParciais,
      p_modelo_id: input.modeloId,
      p_etapas: input.etapas as unknown as Json,
      p_equipe_inicial_id: input.equipeInicialId,
      p_data_inicio: input.dataInicio,
    });
    if (error) throw error;
    revalidatePath(`/obras/${input.obraId}`);
    revalidatePath(`/obras/${input.obraId}/ambiente`);
    revalidatePath('/medicoes');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Falha ao configurar medição.') };
  }
}

const swapSchema = z.object({
  obraId: z.string().uuid(),
  vinculoId: z.string().uuid(),
  novaEquipeId: z.string().uuid(),
  data: z.string().date(),
  motivo: z.string().trim().min(5),
});

export async function swapMeasurementContractor(raw: z.infer<typeof swapSchema>) {
  try {
    const input = swapSchema.parse(raw);
    const context = await requireTenantRole(['admin', 'gestor']);
    await assertObraInTenant(input.obraId, context.clienteId);
    const supabase = await createClient();
    const { error } = await supabase.rpc('trocar_empreiteiro_servico', {
      p_vinculo_id: input.vinculoId,
      p_nova_equipe_id: input.novaEquipeId,
      p_data: input.data,
      p_motivo: input.motivo,
    });
    if (error) throw error;
    revalidatePath(`/obras/${input.obraId}`);
    revalidatePath('/medicoes');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Falha ao trocar empreiteiro.') };
  }
}

export type MeasurementMethod = Database['public']['Enums']['metodo_medicao_servico'];
