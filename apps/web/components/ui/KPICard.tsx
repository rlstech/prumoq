'use client';

import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  colorVariant?: 'default' | 'ok' | 'nok' | 'warn' | 'brand';
}

export default function KPICard({ title, value, icon, subtitle, colorVariant = 'default' }: KPICardProps) {
  const iconColors = {
    default: 'text-txt-3',
    ok: 'text-ok',
    nok: 'text-nok',
    warn: 'text-warn',
    brand: 'text-[var(--br)]',
  };

  const iconBackgrounds = {
    default: 'bg-bg-2',
    ok: 'bg-ok-bg',
    nok: 'bg-nok-bg',
    warn: 'bg-warn-bg',
    brand: 'bg-[var(--brl)]',
  };

  return (
    <div className="bg-bg-1 border border-brd-0 rounded-xl p-5 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-txt-2">{title}</h3>
        {icon && (
          <div className={`p-2 rounded-lg ${iconBackgrounds[colorVariant]} ${iconColors[colorVariant]}`}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-semibold text-txt tracking-tight">{value}</div>
        {subtitle && <p className="text-xs text-txt-3 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
