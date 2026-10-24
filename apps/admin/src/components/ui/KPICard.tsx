import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  colorVariant?: 'default' | 'ok' | 'nok' | 'warn' | 'brand';
}

/** Indicador: ladrilho de ícone no tom do estado e número grande em mono. */
export default function KPICard({ title, value, icon, subtitle, colorVariant = 'default' }: KPICardProps) {
  const tiles = {
    default: 'bg-bg-0 text-txt',
    ok: 'bg-ok-bg text-ok',
    nok: 'bg-nok-bg text-nok',
    warn: 'bg-warn-bg text-warn',
    brand: 'bg-accent text-txt',
  };

  return (
    <div className="prumo-panel flex min-h-[148px] flex-col justify-between gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-txt-2">{title}</h3>
        {icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${tiles[colorVariant]}`}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className="prumo-metric text-[28px] font-bold leading-none tracking-tight text-txt">{value}</div>
        {subtitle && <p className="mt-1.5 text-[13px] text-txt-2">{subtitle}</p>}
      </div>
    </div>
  );
}
