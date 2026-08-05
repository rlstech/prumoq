'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireTenantRole } from '@/lib/auth/context';
import type { Json } from '@prumoq/shared';

const inputSchema = z.object({
  modeloId: z.string().uuid().nullable(), empresaId: z.string().uuid(), nome: z.string().trim().min(1), ativo: z.boolean(),
  etapas: z.array(z.object({ ordem: z.number().int().positive(), nome: z.string().trim().min(1), peso_percentual: z.number().positive().max(100), permite_avanco_parcial: z.boolean(), ativo: z.boolean() })).min(1),
});
export type StageModelInput = z.infer<typeof inputSchema>;

export async function saveStageModel(raw: StageModelInput) {
  try {
    const input = inputSchema.parse(raw);
    await requireTenantRole(['admin']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('salvar_modelo_etapas_medicao', { p_modelo_id: input.modeloId, p_empresa_id: input.empresaId, p_nome: input.nome, p_ativo: input.ativo, p_etapas: input.etapas as unknown as Json });
    if (error) throw error;
    revalidatePath(`/empresas/${input.empresaId}/modelos-medicao`);
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Falha ao salvar modelo.' }; }
}
