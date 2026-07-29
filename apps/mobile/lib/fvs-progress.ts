export const COMPLETED_FVS_STATUSES = new Set([
  'conforme',
  'concluida',
  'concluida_ressalva',
]);

export const IN_PROGRESS_FVS_STATUSES = new Set([
  'em_andamento',
  'em_revisao',
]);

export interface FvsProgressItem {
  status: string;
}

export interface FvsProgressSummary {
  total: number;
  completed: number;
  percentage: number;
}

export function summarizeFvsProgress(
  items: readonly FvsProgressItem[],
): FvsProgressSummary {
  const total = items.length;
  const completed = items.filter(item =>
    COMPLETED_FVS_STATUSES.has(item.status),
  ).length;

  return {
    total,
    completed,
    percentage: total > 0 ? (completed / total) * 100 : 0,
  };
}
