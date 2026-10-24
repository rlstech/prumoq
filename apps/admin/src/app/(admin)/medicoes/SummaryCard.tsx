import { money } from './format';

interface SummaryCardProps {
  label: string;
  /** Valor em destaque (medido). */
  measured: number;
  /** Base do percentual (contratado). */
  reference: number;
  caption: string;
  toMeasure: number;
  released: number;
  blocked: number;
  ariaLabel: string;
}

/** Resumo em grafite: medido em trena sobre o contratado e três ladrilhos. */
export default function SummaryCard({ label, measured, reference, caption, toMeasure, released, blocked, ariaLabel }: SummaryCardProps) {
  const percent = reference > 0 ? Math.min(100, Math.round((measured / reference) * 100)) : 0;
  const tiles = [
    { label: 'A medir', value: money(toMeasure), hint: 'saldo do contrato', tone: '' },
    { label: 'Liberado para medir', value: money(released), hint: 'FVS conformes ainda não medidas', tone: 'text-accent' },
    { label: 'Bloqueado por NC', value: money(blocked), hint: 'aguardando reinspeção', tone: blocked > 0 ? 'text-[#FF8A80]' : '' },
  ];
  return (
    <section aria-label={ariaLabel} className="on-brand flex flex-wrap items-stretch gap-6 rounded-2xl bg-sidebar px-7 py-6 text-white">
      <div className="flex min-w-[260px] flex-[2_1_360px] flex-col justify-center gap-3">
        <span className="text-[13px] font-semibold text-on-brand">{label}</span>
        <span className="prumo-metric text-[40px] font-bold leading-none tracking-[-0.02em]">{money(measured)}</span>
        <div className="h-3.5 overflow-hidden rounded-full bg-brand-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Percentual medido">
          <div className="prumo-tape-on-dark h-full rounded-full" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[13px] text-on-brand">
          <b className="prumo-metric text-white">{percent}%</b> · {caption}
        </span>
      </div>
      <div className="grid min-w-0 flex-[3_1_420px] grid-cols-1 gap-2 sm:grid-cols-3">
        {tiles.map(tile => (
          <div key={tile.label} className="flex flex-col gap-1.5 rounded-[22px] bg-[#26292D] p-4">
            <span className="text-[13px] text-on-brand">{tile.label}</span>
            <span className={`prumo-metric text-[22px] font-bold leading-tight ${tile.tone}`}>{tile.value}</span>
            <span className="text-xs text-on-brand">{tile.hint}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
