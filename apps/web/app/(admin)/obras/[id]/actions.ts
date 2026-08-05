'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertObraInTenant, requireTenantRole } from '@/lib/auth/context';

async function requireObra(obraId: string) {
  const context = await requireTenantRole(['admin', 'gestor']);
  await assertObraInTenant(obraId, context.clienteId);
  return context;
}

type FeatureOverrideInput = {
  controleMedicoesOverride: boolean | null;
  controleFinanceiroNcOverride: boolean | null;
};

export async function updateObraFeatureOverrides(obraId: string, input: FeatureOverrideInput) {
  try {
    await requireObra(obraId);
    const supabase = await createClient();
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      name: 'set_obra_feature_overrides',
      args: {
        p_obra_id: string;
        p_medicoes_override: boolean | null;
        p_financeiro_override: boolean | null;
      },
    ) => Promise<{ error: { message: string } | null }>;
    const { error } = await rpc('set_obra_feature_overrides', {
      p_obra_id: obraId,
      p_medicoes_override: input.controleMedicoesOverride,
      p_financeiro_override: input.controleFinanceiroNcOverride,
    });
    if (error) throw error;
    revalidatePath(`/obras/${obraId}`);
    revalidatePath('/medicoes');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao configurar recursos da obra.' };
  }
}

export async function createAmbiente(
  obraId: string,
  formData: { nome: string; tipo: string; localizacao: string; observacoes: string },
  selectedFvsIds: string[],
  fvsPadraoList: { id: string; nome: string; revisao_atual: number }[],
) {
  try {
    const context = await requireObra(obraId);
    const supabase = await createClient();
    const { data: ambiente, error } = await supabase.from('ambientes').insert({
      cliente_id: context.clienteId,
      nome: formData.nome.trim(),
      tipo: formData.tipo.toLowerCase() as 'interno' | 'externo',
      localizacao: formData.localizacao || null,
      observacoes: formData.observacoes || null,
      obra_id: obraId,
      ativo: true,
    }).select().single();
    if (error) throw error;

    if (selectedFvsIds.length) {
      const allowedIds = new Set(fvsPadraoList.map(item => item.id));
      if (selectedFvsIds.some(id => !allowedIds.has(id))) throw new Error('FVS fora do escopo desta empresa.');
      const { error: fvsError } = await supabase.from('fvs_planejadas').insert(
        selectedFvsIds.map(fvsId => {
          const padrao = fvsPadraoList.find(item => item.id === fvsId);
          return {
            cliente_id: context.clienteId,
            ambiente_id: ambiente.id,
            fvs_padrao_id: fvsId,
            subservico: padrao?.nome ?? 'Serviço Padrão',
            revisao_associada: padrao?.revisao_atual ?? 1,
            status: 'pendente' as const,
          };
        }),
      );
      if (fvsError) throw fvsError;
    }
    revalidatePath(`/obras/${obraId}`);
    return { success: true, data: ambiente };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao criar ambiente.' };
  }
}

export async function addEquipeToObra(obraId: string, equipeIds: string[]) {
  try {
    if (!equipeIds.length) return { success: false, error: 'Selecione ao menos uma equipe.' };
    const context = await requireObra(obraId);
    const supabase = await createClient();
    const { error } = await supabase.from('obra_equipes').insert(
      equipeIds.map(equipeId => ({
        cliente_id: context.clienteId,
        obra_id: obraId,
        equipe_id: equipeId,
      })),
    );
    if (error) throw error;
    revalidatePath(`/obras/${obraId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao vincular equipe.' };
  }
}

export async function removeEquipeFromObra(obraId: string, equipeId: string) {
  try {
    const context = await requireObra(obraId);
    const supabase = await createClient();
    const { error } = await supabase.from('obra_equipes').delete()
      .eq('obra_id', obraId).eq('equipe_id', equipeId).eq('cliente_id', context.clienteId);
    if (error) throw error;
    revalidatePath(`/obras/${obraId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao remover equipe.' };
  }
}

export async function deleteObra(obraId: string) {
  try {
    const context = await requireTenantRole(['admin']);
    await assertObraInTenant(obraId, context.clienteId);
    // Service role: RLS não possui policy de DELETE em obras — o client SSR
    // deletaria 0 linhas silenciosamente. As verificações de auth/tenant acima
    // garantem a segurança no lugar da RLS.
    const admin = createAdminClient();

    const [amb, usr, eq] = await Promise.all([
      admin.from('ambientes').select('id', { count: 'exact', head: true })
        .eq('obra_id', obraId).eq('cliente_id', context.clienteId),
      admin.from('obra_usuarios').select('id', { count: 'exact', head: true })
        .eq('obra_id', obraId).eq('cliente_id', context.clienteId),
      admin.from('obra_equipes').select('id', { count: 'exact', head: true })
        .eq('obra_id', obraId).eq('cliente_id', context.clienteId),
    ]);

    const counts = {
      ambientes: amb.count ?? 0,
      usuarios: usr.count ?? 0,
      equipes: eq.count ?? 0,
    };
    const total = counts.ambientes + counts.usuarios + counts.equipes;
    if (total > 0) {
      const partes = [
        counts.ambientes && `${counts.ambientes} ambiente(s)`,
        counts.usuarios && `${counts.usuarios} usuário(s) vinculado(s)`,
        counts.equipes && `${counts.equipes} equipe(s) vinculada(s)`,
      ].filter(Boolean).join(', ');
      return {
        success: false,
        error: `Obra não pode ser excluída: possui ${partes}. Remova-os antes de tentar novamente.`,
      };
    }

    const { data: deleted, error } = await admin.from('obras').delete()
      .eq('id', obraId).eq('cliente_id', context.clienteId).select('id');
    if (error) throw error;
    if (!deleted?.length) {
      return { success: false, error: 'Obra não encontrada ou já excluída.' };
    }

    revalidatePath('/obras');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao excluir obra.' };
  }
}

export async function addFvsToAmbiente(
  obraId: string,
  ambId: string,
  selectedFvsIds: string[],
  fvsPadraoList: { id: string; nome: string; revisao_atual: number }[],
) {
  try {
    const context = await requireObra(obraId);
    if (!selectedFvsIds.length) return { success: true };
    const allowedIds = new Set(fvsPadraoList.map(item => item.id));
    if (selectedFvsIds.some(id => !allowedIds.has(id))) throw new Error('FVS fora do escopo desta empresa.');
    const supabase = await createClient();
    const { data: ambiente } = await supabase.from('ambientes').select('id').eq('id', ambId).eq('obra_id', obraId).maybeSingle();
    if (!ambiente) throw new Error('Ambiente fora do escopo da obra.');
    const { error } = await supabase.from('fvs_planejadas').insert(selectedFvsIds.map(fvsId => {
      const padrao = fvsPadraoList.find(item => item.id === fvsId);
      return {
        cliente_id: context.clienteId,
        ambiente_id: ambId,
        fvs_padrao_id: fvsId,
        subservico: padrao?.nome ?? 'Serviço Padrão',
        revisao_associada: padrao?.revisao_atual ?? 1,
        status: 'pendente' as const,
      };
    }));
    if (error) throw error;
    revalidatePath(`/obras/${obraId}/ambiente/${ambId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao associar FVS.' };
  }
}
