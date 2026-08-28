/** Shared shapes for the contractor evaluation capture flow. */

/** `resultado_criterio_avaliacao` — binary, unlike the FVS checklist. */
export type EvaluationResult = 'atende' | 'nao_atende';

/** One criterion of the selected model revision. `peso` is 1..10 (migration 064). */
export interface EvaluationCriterion {
  id: string;
  titulo: string;
  peso: number;
  ordem: number;
}

/** Keys used by the validation map, so the pending list can route a tap back to
 * the field that produced the error. */
export const errorKeys = {
  obra: 'obra',
  equipe: 'equipe',
  modelo: 'modelo',
  identidade: 'identidade',
  providencias: 'providencias',
  assinatura: 'assinatura',
  criterio: (id: string) => `criterio:${id}`,
  justificativa: (id: string) => `justificativa:${id}`,
} as const;

/** The step an error belongs to — drives the "Corrigir" jump. */
export function stepForError(key: string): 'avaliacao' | 'fechamento' {
  return key.startsWith('criterio:') || key.startsWith('justificativa:')
    || key === errorKeys.obra || key === errorKeys.equipe || key === errorKeys.modelo
    ? 'avaliacao'
    : 'fechamento';
}

/** The criterion an error points at, when it points at one. */
export function criterionIdForError(key: string): string | null {
  const [prefix, id] = key.split(':');
  return (prefix === 'criterio' || prefix === 'justificativa') && id ? id : null;
}
