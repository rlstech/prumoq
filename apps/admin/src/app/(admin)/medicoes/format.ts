// Formatação comum das telas de contratos e medições (datas em Brasília).
export const money = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const num = (n: number | null | undefined, digits = 2) =>
  Number(n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });

/** Datas `YYYY-MM-DD` (sem hora) viram dd/mm/aaaa sem passar por fuso. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';

export const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0);

export const measurementStatus: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-warn-bg text-warn' },
  aprovada: { label: 'Aprovada', className: 'bg-ok-bg text-ok' },
  cancelada: { label: 'Cancelada', className: 'bg-nok-bg text-nok' },
};

/** Próxima referência sugerida: "BM 01", "BM 02"... a partir das já usadas no contrato. */
export function nextReference(used: string[]): string {
  const numbers = used.map(ref => Number(/(\d+)\s*$/.exec(ref)?.[1] ?? 0));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `BM ${String(next).padStart(2, '0')}`;
}

/** Dia seguinte de uma data `YYYY-MM-DD` (sem fuso). */
export function nextDay(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, day + 1));
  return next.toISOString().slice(0, 10);
}
