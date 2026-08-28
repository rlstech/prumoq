'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireTenantRole } from '@/lib/auth/context';
import type { Json } from '@prumoq/shared';

const criteriaSchema = z.array(z.object({ titulo: z.string().trim().min(1), peso: z.number().int().min(1).max(10) })).min(1);
const modelSchema = z.object({ id: z.string().uuid().nullable(), empresaId: z.string().uuid().nullable(), nome: z.string().trim().min(3), descricao: z.string().nullable(), ativo: z.boolean(), alteracoes: z.string().trim().min(3), criterios: criteriaSchema });

function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'; }

export async function saveEvaluationModel(raw: z.infer<typeof modelSchema>) {
  try {
    const input = modelSchema.parse(raw);
    await requireTenantRole(['admin']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('publicar_modelo_avaliacao_empreiteiro', {
      p_modelo_id: input.id, p_empresa_id: input.empresaId, p_nome: input.nome,
      p_descricao: input.descricao, p_ativo: input.ativo, p_descricao_alteracoes: input.alteracoes,
      p_criterios: input.criterios.map((item, index) => ({ ordem: index + 1, ...item })) as unknown as Json,
    });
    if (error) throw error;
    revalidatePath('/avaliacoes');
    return { success: true };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function invalidateEvaluation(id: string, reason: string) {
  try {
    z.string().uuid().parse(id);
    z.string().trim().min(3).parse(reason);
    await requireTenantRole(['admin', 'gestor']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('invalidar_avaliacao_empreiteiro', { p_avaliacao_id: id, p_motivo: reason });
    if (error) throw error;
    revalidatePath('/avaliacoes');
    return { success: true };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function approveEvaluation(id: string) {
  try {
    z.string().uuid().parse(id);
    await requireTenantRole(['admin', 'gestor']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('aprovar_avaliacao_empreiteiro', { p_avaliacao_id: id });
    if (error) throw error;
    revalidatePath('/avaliacoes');
    revalidatePath('/medicoes');
    return { success: true };
  } catch (error) { return { success: false, error: message(error) }; }
}

export async function reopenEvaluation(id: string, reason: string) {
  try {
    z.string().uuid().parse(id);
    z.string().trim().min(3).parse(reason);
    await requireTenantRole(['admin', 'gestor']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('reabrir_avaliacao_empreiteiro', { p_avaliacao_id: id, p_motivo: reason });
    if (error) throw error;
    revalidatePath('/avaliacoes');
    revalidatePath('/medicoes');
    return { success: true };
  } catch (error) { return { success: false, error: message(error) }; }
}
