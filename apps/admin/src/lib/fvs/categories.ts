export const FVS_CATEGORIES = [
  { value: 'servicos_preliminares', label: 'Serviços preliminares' },
  { value: 'terraplanagem', label: 'Terraplanagem' },
  { value: 'fundacao', label: 'Fundação' },
  { value: 'estrutura', label: 'Estrutura' },
  { value: 'vedacao', label: 'Vedação' },
  { value: 'impermeabilizacao', label: 'Impermeabilização' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'revestimento', label: 'Revestimento' },
  { value: 'esquadrias_vidros', label: 'Esquadrias e vidros' },
  { value: 'instalacoes', label: 'Instalações' },
  { value: 'acabamento', label: 'Acabamento' },
  { value: 'urbanizacao_pavimentacao', label: 'Urbanização e pavimentação' },
  { value: 'comunicacao_visual', label: 'Comunicação visual' },
  { value: 'outro', label: 'Outro' },
] as const;

export type FvsCategoryValue = (typeof FVS_CATEGORIES)[number]['value'];

export const FVS_CATEGORY_LABELS: Record<FvsCategoryValue, string> = Object.fromEntries(
  FVS_CATEGORIES.map(category => [category.value, category.label]),
) as Record<FvsCategoryValue, string>;

export function getFvsCategoryLabel(value: string): string {
  return (FVS_CATEGORY_LABELS as Record<string, string>)[value] ?? value;
}

const CATEGORY_ALIASES: Record<string, FvsCategoryValue> = {
  fundacoes: 'fundacao',
  servico_preliminar: 'servicos_preliminares',
  servicos_preliminares: 'servicos_preliminares',
  esquadrias: 'esquadrias_vidros',
  esquadrias_e_vidros: 'esquadrias_vidros',
  urbanizacao: 'urbanizacao_pavimentacao',
  pavimentacao: 'urbanizacao_pavimentacao',
  urbanizacao_e_pavimentacao: 'urbanizacao_pavimentacao',
};

export function normalizeFvsCategory(raw: string): FvsCategoryValue {
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const direct = FVS_CATEGORIES.find(category => category.value === normalized)?.value;
  return direct ?? CATEGORY_ALIASES[normalized] ?? 'outro';
}
