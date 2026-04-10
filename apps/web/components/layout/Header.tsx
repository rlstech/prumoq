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
    <header className="h-[56px] min-h-[56px] border-b border-brd-0 bg-bg-1 px-6 flex items-center justify-between sticky top-0 z-20">
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          
          return (
            <div key={idx} className="flex items-center gap-1 text-txt-2">
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="hover:text-txt transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-txt font-medium' : ''}>
                  {crumb.label}
                </span>
              )}
              
              {!isLast && <ChevronRight size={14} className="text-txt-3 mx-1" />}
            </div>
          );
        })}
      </nav>
      
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}
