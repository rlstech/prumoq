'use client';

interface ProgressBarProps {
  value: number;
  variant?: 'brand' | 'ok' | 'nok' | 'pg';
  showLabel?: boolean;
}

export default function ProgressBar({ value, variant = 'brand', showLabel = false }: ProgressBarProps) {
  const boundedValue = Math.min(100, Math.max(0, value));
  
  const colors = {
    brand: 'bg-[var(--br)]',
    ok: 'bg-ok-mid',
    nok: 'bg-nok',
    pg: 'bg-pg',
  };

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-2">
        <div 
          className={`h-full rounded-full transition-all duration-300 ease-out ${colors[variant]}`}
          style={{ width: `${boundedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="prumo-metric w-9 text-right text-xs font-semibold text-txt-2">
          {boundedValue}%
        </span>
      )}
    </div>
  );
}
