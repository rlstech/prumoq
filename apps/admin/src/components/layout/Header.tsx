
import { ReactNode } from 'react';
import { ChevronRight } from '@/components/icons';
import Link from '@/lib/compat/link';
import { usePathname } from '@/lib/compat/navigation';
import { NAV_GROUPS } from '@/components/layout/Sidebar';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs: BreadcrumbItem[];
  actions?: ReactNode;
}

/** Nome do grupo do menu ao qual a rota atual pertence — o primeiro nível da trilha. */
function groupForPath(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return group.label;
    }
  }
  return null;
}

/**
 * Barra superior fina: diz apenas onde o usuário está e oferece ações globais da
 * rota. O título, a descrição e a ação primária da tela ficam no PageHeader.
 */
export default function Header({ breadcrumbs, actions }: HeaderProps) {
  const pathname = usePathname();
  const group = groupForPath(pathname);
  const trail: BreadcrumbItem[] = group ? [{ label: group }, ...breadcrumbs] : breadcrumbs;

  return (
    <header className="flex h-[60px] min-h-[60px] shrink-0 items-center justify-between gap-5 px-4 pl-[68px] pt-2 md:px-7 md:pt-3">
      <nav className="flex min-w-0 items-center gap-2 text-[13px]" aria-label="Trilha de navegação">
        {trail.map((crumb, idx) => {
          const isLast = idx === trail.length - 1;

          return (
            <div key={`${crumb.label}-${idx}`} className="flex min-w-0 items-center gap-2 font-semibold text-txt-2">
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="truncate transition-colors hover:text-txt">
                  {crumb.label}
                </Link>
              ) : (
                <span className={`truncate ${isLast ? 'text-txt' : ''}`}>{crumb.label}</span>
              )}

              {!isLast && <ChevronRight size={14} className="shrink-0 text-brd-2" aria-hidden="true" />}
            </div>
          );
        })}
      </nav>

      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}
