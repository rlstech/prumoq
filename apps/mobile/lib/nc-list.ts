export type NcTab = 'abertas' | 'resolvidas' | 'todas';
export type NcUrgency = 'all' | 'overdue' | 'today' | 'soon' | 'scheduled' | 'unscheduled';
export type NcPriority = 'all' | 'alta' | 'media' | 'baixa';
export type NcTimingBucket = Exclude<NcUrgency, 'all'>;

export interface NcListItem {
  id: string;
  descricao: string;
  status: string;
  data_nova_verif: string | null;
  prioridade: string;
  item_titulo: string;
  ambiente_nome: string;
  obra_nome: string;
  responsavel_nome: string | null;
}

export interface NcListFilters {
  tab: NcTab;
  search: string;
  urgency: NcUrgency;
  priority: NcPriority;
}

export interface NcTiming {
  bucket: NcTimingBucket;
  days: number | null;
  label: string;
  shortLabel: string;
  dateLabel: string | null;
  sortWeight: number;
}

const DAY_MS = 86_400_000;

export function isActionableNc(status: string): boolean {
  return status === 'aberta' || status === 'em_correcao';
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function formatNcDate(value: string | null | undefined): string | null {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;
  return new Intl.DateTimeFormat('pt-BR').format(parsed);
}

export function getNcTiming(
  value: string | null | undefined,
  referenceDate = new Date(),
): NcTiming {
  const dueDate = parseDateOnly(value);
  if (!dueDate) {
    return {
      bucket: 'unscheduled',
      days: null,
      label: 'Prazo não informado',
      shortLabel: 'Sem prazo',
      dateLabel: null,
      sortWeight: Number.MAX_SAFE_INTEGER,
    };
  }

  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const days = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
  const dateLabel = formatNcDate(value);

  if (days < 0) {
    const elapsed = Math.abs(days);
    return {
      bucket: 'overdue',
      days,
      label: `Vencida há ${elapsed} dia${elapsed === 1 ? '' : 's'}`,
      shortLabel: `${elapsed}d em atraso`,
      dateLabel,
      sortWeight: days,
    };
  }
  if (days === 0) {
    return {
      bucket: 'today',
      days,
      label: 'Vence hoje',
      shortLabel: 'Hoje',
      dateLabel,
      sortWeight: days,
    };
  }
  if (days <= 3) {
    return {
      bucket: 'soon',
      days,
      label: `Vence em ${days} dia${days === 1 ? '' : 's'}`,
      shortLabel: `Em ${days}d`,
      dateLabel,
      sortWeight: days,
    };
  }
  return {
    bucket: 'scheduled',
    days,
    label: `Prazo em ${days} dias`,
    shortLabel: dateLabel ?? 'Programada',
    dateLabel,
    sortWeight: days,
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function matchesTab(item: NcListItem, tab: NcTab): boolean {
  if (tab === 'abertas') return isActionableNc(item.status);
  if (tab === 'resolvidas') return item.status === 'resolvida';
  return true;
}

function priorityWeight(priority: string): number {
  if (priority === 'alta') return 0;
  if (priority === 'media') return 1;
  if (priority === 'baixa') return 2;
  return 3;
}

function statusWeight(status: string): number {
  if (isActionableNc(status)) return 0;
  if (status === 'resolvida') return 1;
  return 2;
}

export function filterAndSortNcs<T extends NcListItem>(
  items: readonly T[],
  filters: NcListFilters,
  referenceDate = new Date(),
): T[] {
  const query = normalize(filters.search);
  return items
    .filter(item => {
      if (!matchesTab(item, filters.tab)) return false;
      if (filters.priority !== 'all' && item.prioridade !== filters.priority) return false;
      if (filters.urgency !== 'all') {
        if (!isActionableNc(item.status)) return false;
        if (getNcTiming(item.data_nova_verif, referenceDate).bucket !== filters.urgency) return false;
      }
      if (!query) return true;
      return normalize([
        item.item_titulo,
        item.descricao,
        item.obra_nome,
        item.ambiente_nome,
        item.responsavel_nome,
      ].join(' ')).includes(query);
    })
    .sort((left, right) => {
      const byStatus = statusWeight(left.status) - statusWeight(right.status);
      if (byStatus !== 0) return byStatus;
      if (isActionableNc(left.status) && isActionableNc(right.status)) {
        const byDeadline = getNcTiming(left.data_nova_verif, referenceDate).sortWeight
          - getNcTiming(right.data_nova_verif, referenceDate).sortWeight;
        if (byDeadline !== 0) return byDeadline;
      }
      const byPriority = priorityWeight(left.prioridade) - priorityWeight(right.prioridade);
      if (byPriority !== 0) return byPriority;
      return left.item_titulo.localeCompare(right.item_titulo, 'pt-BR');
    });
}

export interface NcSummary {
  actionable: number;
  overdue: number;
  today: number;
  resolved: number;
}

export function summarizeNcs(
  items: readonly NcListItem[],
  referenceDate = new Date(),
): NcSummary {
  return items.reduce<NcSummary>((summary, item) => {
    if (isActionableNc(item.status)) {
      summary.actionable += 1;
      const bucket = getNcTiming(item.data_nova_verif, referenceDate).bucket;
      if (bucket === 'overdue') summary.overdue += 1;
      if (bucket === 'today') summary.today += 1;
    }
    if (item.status === 'resolvida') summary.resolved += 1;
    return summary;
  }, { actionable: 0, overdue: 0, today: 0, resolved: 0 });
}

export type NcGroupKey = NcTimingBucket | 'resolved' | 'historical';

export interface NcGroup<T extends NcListItem> {
  key: NcGroupKey;
  title: string;
  description: string;
  items: T[];
}

const GROUP_META: Record<NcGroupKey, { title: string; description: string }> = {
  overdue: { title: 'Vencidas', description: 'Correções fora do prazo' },
  today: { title: 'Vencem hoje', description: 'Reinspeções com ação imediata' },
  soon: { title: 'Próximos 3 dias', description: 'Prazos que exigem preparação' },
  scheduled: { title: 'Programadas', description: 'Demais correções em acompanhamento' },
  unscheduled: { title: 'Sem prazo', description: 'Registros que precisam de programação' },
  resolved: { title: 'Resolvidas', description: 'Itens aprovados em reinspeção' },
  historical: { title: 'Histórico', description: 'Ocorrências encerradas sem resolução' },
};

const GROUP_ORDER: NcGroupKey[] = [
  'overdue',
  'today',
  'soon',
  'scheduled',
  'unscheduled',
  'resolved',
  'historical',
];

export function groupNcs<T extends NcListItem>(
  items: readonly T[],
  referenceDate = new Date(),
): NcGroup<T>[] {
  const grouped = new Map<NcGroupKey, T[]>();
  items.forEach(item => {
    const key: NcGroupKey = isActionableNc(item.status)
      ? getNcTiming(item.data_nova_verif, referenceDate).bucket
      : item.status === 'resolvida'
        ? 'resolved'
        : 'historical';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return GROUP_ORDER.flatMap(key => {
    const groupItems = grouped.get(key);
    if (!groupItems?.length) return [];
    return [{ key, ...GROUP_META[key], items: groupItems }];
  });
}
