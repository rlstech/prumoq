interface ProgressBarProps {
  value: number;
  variant?: 'brand' | 'ok' | 'nok' | 'pg';
  showLabel?: boolean;
}

/**
 * Trena: fita em pílula. `brand` é grafite com marcas amarelas a cada 8px;
 * os demais tons são sólidos. Em 100% a fita `brand` fica verde (concluída).
 */
export default function ProgressBar({ value, variant = 'brand', showLabel = false }: ProgressBarProps) {
  const boundedValue = Math.min(100, Math.max(0, value));
  const effective = variant === 'brand' && boundedValue >= 100 ? 'ok' : variant;

  const colors = {
    brand: 'prumo-tape',
    ok: 'bg-ok',
    nok: 'bg-nok',
    pg: 'bg-pg',
  };

  return (
    <div className="flex w-full items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-0"
        role="progressbar"
        aria-valuenow={Math.round(boundedValue)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${colors[effective]}`}
          style={{ width: `${boundedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="prumo-metric w-10 text-right text-[13px] font-bold text-txt">
          {Math.round(boundedValue)}%
        </span>
      )}
    </div>
  );
}
