import Link from '@/lib/compat/link';
import { ChevronLeft, ChevronRight } from '@/components/icons';

interface PaginationProps {
  page: number;
  hasNextPage: boolean;
  pathname: string;
}

export default function Pagination({ page, hasNextPage, pathname }: PaginationProps) {
  if (page === 1 && !hasNextPage) return null;

  const hrefFor = (targetPage: number) => targetPage === 1 ? pathname : `${pathname}?page=${targetPage}`;
  const button = 'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors';

  return (
    <nav className="mt-4 flex items-center justify-between gap-3 px-1" aria-label="Paginação">
      <span className="text-[13px] text-txt-2">
        Página <span className="font-mono font-bold text-txt">{page}</span>
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={`${button} bg-bg-1 text-txt hover:bg-bg-2`}>
            <ChevronLeft size={16} /> Anterior
          </Link>
        ) : null}
        {hasNextPage ? (
          <Link href={hrefFor(page + 1)} className={`${button} on-brand bg-sidebar text-white hover:bg-brand-dark`}>
            Próxima <ChevronRight size={16} />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
