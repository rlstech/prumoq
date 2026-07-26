'use client';

import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs: BreadcrumbItem[];
  actions?: ReactNode;
}

export default function Header({ breadcrumbs, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] min-h-[72px] items-center justify-between border-b border-brd-0 bg-bg-1/95 px-4 pl-16 backdrop-blur md:px-8 md:pl-8">
      <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          
          return (
            <div key={idx} className="flex min-w-0 items-center gap-1 text-txt-2">
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="hover:text-txt transition-colors">
                  <span className="truncate">{crumb.label}</span>
                </Link>
              ) : (
                <span className={`truncate ${isLast ? 'font-semibold text-txt' : ''}`}>
                  {crumb.label}
                </span>
              )}
              
              {!isLast && <ChevronRight size={14} className="text-txt-3 mx-1" />}
            </div>
          );
        })}
      </nav>
      
      {actions && (
        <div className="ml-4 flex shrink-0 items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}
