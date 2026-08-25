'use client';

import Link from 'next/link';

interface PaginationProps {
  page: number;
  hasNextPage: boolean;
  pathname: string;
}

export default function Pagination({ page, hasNextPage, pathname }: PaginationProps) {
  if (page === 1 && !hasNextPage) return null;

  const hrefFor = (targetPage: number) => targetPage === 1 ? pathname : `${pathname}?page=${targetPage}`;

  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Paginação">
      <span className="text-xs text-txt-3">Página {page}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="rounded-md border border-brd-1 bg-bg-1 px-3 py-2 text-xs font-medium text-txt-2 transition-colors hover:bg-bg-2 hover:text-txt">
            Anterior
          </Link>
        ) : null}
        {hasNextPage ? (
          <Link href={hrefFor(page + 1)} className="rounded-md border border-brd-1 bg-bg-1 px-3 py-2 text-xs font-medium text-txt-2 transition-colors hover:bg-bg-2 hover:text-txt">
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
