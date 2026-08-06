export type NcFinancialSituation = 'sem_impacto' | 'em_avaliacao' | 'estimado' | 'confirmado';
export type NcMeasurementBlock = 'nao' | 'total' | 'parcial';

export interface NcFinancialDeclaration {
  situacao: NcFinancialSituation;
  bloqueio: NcMeasurementBlock;
  justificativaSemImpacto?: string | null;
  responsavelAvaliacaoId?: string | null;
  prazoAvaliacao?: string | null;
  valorEstimado?: string | null;
  valorConfirmado?: string | null;
  responsavelFinanceiro?: 'construtora' | 'empreiteiro' | 'fornecedor' | 'projetista' | 'em_analise' | null;
  categoria?: 'mao_obra_retrabalho' | 'perda_material' | 'equipamento_mobilizacao' | 'atraso' | 'glosa_retencao' | 'desconto_empreiteiro' | 'outro' | null;
  valorBloqueado?: string | null;
}

function isPositiveDecimal(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0;
}

export function validateNcFinancialDeclaration(value: NcFinancialDeclaration | null | undefined): string | null {
  if (!value) return 'Declare a situação financeira da não conformidade.';
  if (value.situacao === 'sem_impacto' && (!value.justificativaSemImpacto?.trim() || value.valorConfirmado !== '0')) return 'Sem impacto exige justificativa e valor zero.';
  if (value.situacao === 'em_avaliacao' && (!value.responsavelAvaliacaoId || !value.prazoAvaliacao)) return 'Impacto em avaliação exige responsável e prazo.';
  if ((value.situacao === 'estimado' && (!isPositiveDecimal(value.valorEstimado) || !value.responsavelFinanceiro || !value.categoria)) || (value.situacao === 'confirmado' && (!isPositiveDecimal(value.valorConfirmado) || !value.responsavelFinanceiro || !value.categoria))) return 'Informe valor positivo, responsável e categoria financeira.';
  if (value.bloqueio === 'parcial' && !isPositiveDecimal(value.valorBloqueado)) return 'Bloqueio parcial exige valor bloqueado positivo.';
  return null;
}
