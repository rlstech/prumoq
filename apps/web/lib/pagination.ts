export const PAGE_SIZE = 50;

export function pageFromSearchParam(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(candidate ?? '1', 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function pageRange(page: number, size = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * size;
  return { from, to: from + size };
}

export function pageSlice<T>(rows: T[], size = PAGE_SIZE): { rows: T[]; hasNextPage: boolean } {
  return {
    rows: rows.slice(0, size),
    hasNextPage: rows.length > size,
  };
}
