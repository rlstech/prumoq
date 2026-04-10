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
      <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ease-out ${colors[variant]}`}
          style={{ width: `${boundedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-txt-2 w-8 text-right">
          {boundedValue}%
        </span>
      )}
    </div>
  );
}
