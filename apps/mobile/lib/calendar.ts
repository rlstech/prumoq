export interface CalendarMonth {
  year: number;
  month: number;
}

export interface CalendarDay {
  iso: string;
  day: number;
}

export const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

const WEEKDAY_NAMES = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado',
] as const;

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month - 1);
}

export function getTodayIso(now = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

export function monthFromIso(value: string, fallback = getTodayIso()): CalendarMonth {
  const source = isIsoDate(value) ? value : fallback;
  const [year, month] = source.split('-').map(Number);
  return { year, month: month - 1 };
}

export function shiftMonth(month: CalendarMonth, amount: number): CalendarMonth {
  const absolute = month.year * 12 + month.month + amount;
  return { year: Math.floor(absolute / 12), month: ((absolute % 12) + 12) % 12 };
}

export function getMonthDays(month: CalendarMonth): Array<CalendarDay | null> {
  const firstWeekday = new Date(Date.UTC(month.year, month.month, 1)).getUTCDay();
  const cells: Array<CalendarDay | null> = Array.from({ length: firstWeekday }, () => null);
  const days = daysInMonth(month.year, month.month);
  for (let day = 1; day <= days; day += 1) {
    cells.push({ iso: toIso(month.year, month.month, day), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatDate(value: string): string {
  if (!isIsoDate(value)) return 'Selecionar data';
  const [year, month, day] = value.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function formatMonth(month: CalendarMonth): string {
  return `${MONTH_NAMES[month.month]} de ${month.year}`;
}

export function formatDateAccessibility(value: string): string {
  if (!isIsoDate(value)) return 'Nenhuma data selecionada';
  const [year, month, day] = value.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAY_NAMES[weekday]}, ${day} de ${MONTH_NAMES[month - 1]} de ${year}`;
}

export function isDateWithinRange(value: string, min?: string, max?: string): boolean {
  if (!isIsoDate(value)) return false;
  return (!min || !isIsoDate(min) || value >= min) && (!max || !isIsoDate(max) || value <= max);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
