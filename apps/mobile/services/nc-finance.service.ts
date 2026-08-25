import type { NcFinancialDeclaration } from '../lib/nc-finance';
import { validateNcFinancialDeclaration } from '../lib/nc-finance';
import { supabase } from '../lib/supabase';

export type FinalNcFinancialDeclaration = NcFinancialDeclaration & {
  situacao: 'sem_impacto' | 'confirmado';
};

function asNumber(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Resolves a financial impact through the same server-authorized RPC used by
 * the admin panel. This is deliberately online-only: the final decision is
 * audited and must be accepted by the database before a NC can be closed. */
export async function resolveNcFinancialImpact(
  ncId: string,
  declaration: FinalNcFinancialDeclaration,
): Promise<void> {
  const validationError = validateNcFinancialDeclaration(declaration);
  if (validationError) throw new Error(validationError);

  let error: Error | null = null;
  try {
    ({ error } = await supabase.rpc('atualizar_impacto_financeiro_nc', {
    p_nc_id: ncId,
    p_situacao: declaration.situacao,
    p_bloqueio: declaration.bloqueio,
    p_justificativa: declaration.justificativaSemImpacto?.trim() || null,
    p_responsavel_avaliacao: null,
    p_prazo: null,
    p_valor_estimado: null,
    p_valor_confirmado: declaration.situacao === 'sem_impacto'
      ? 0
      : asNumber(declaration.valorConfirmado),
    p_responsavel_financeiro: declaration.situacao === 'confirmado'
      ? declaration.responsavelFinanceiro ?? null
      : null,
    p_categoria: declaration.situacao === 'confirmado'
      ? declaration.categoria ?? null
      : null,
    p_valor_bloqueado: declaration.bloqueio === 'parcial'
      ? asNumber(declaration.valorBloqueado)
      : null,
    p_observacao: null,
      p_documento: null,
    }));
  } catch {
    throw new Error('Não foi possível conectar para concluir o impacto financeiro. Verifique sua conexão e tente novamente.');
  }

  if (error) {
    if (error.message.toLowerCase().includes('permiss')) {
      throw new Error('Sua conta não tem permissão para concluir este impacto financeiro.');
    }
    throw new Error('Não foi possível concluir o impacto financeiro. Tente novamente.');
  }
}
