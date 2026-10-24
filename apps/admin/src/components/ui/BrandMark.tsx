import { faceSymbolGeometry, trenaPalette } from '@prumoq/design-system';

type BrandMarkVariant = 'onBrand' | 'onLight';

interface Props {
  size?: number;
  /** `onBrand`: Q branco sobre o grafite (menu, login). `onLight`: Q grafite sobre claro. */
  variant?: BrandMarkVariant;
  className?: string;
}

/**
 * Marca PrumoQ — "Q de face": o Q com a perninha trocada por um prumo de face
 * (cordão, taco deitado e peso cilíndrico da mesma largura). O peso é sempre
 * amarelo; os frisos só aparecem a partir de 40px. Geometria em
 * `faceSymbolGeometry`, a mesma do PWA.
 */
export function BrandMark({ size = 40, variant = 'onBrand', className }: Props) {
  const g = faceSymbolGeometry;
  const ink = variant === 'onBrand' ? trenaPalette.white : trenaPalette.graphite;
  const showRibs = size >= 40;

  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox={g.fittedViewBox} fill="none">
      <circle cx={g.ring.cx} cy={g.ring.cy} r={g.ring.radius} stroke={ink} strokeWidth={g.ring.strokeWidth} />
      <path
        d={`M${g.cordTop.x} ${g.cordTop.top}V${g.cordTop.bottom}M${g.cordBottom.x} ${g.cordBottom.top}V${g.cordBottom.bottom}`}
        stroke={ink}
        strokeWidth={g.cordTop.strokeWidth}
      />
      <rect x={g.taco.x} y={g.taco.y} width={g.taco.width} height={g.taco.height} rx={g.taco.radius} fill={ink} />
      <path d={g.weightPath} fill={trenaPalette.tapeYellow} />
      {showRibs ? (
        <path
          d={g.ribs.y.map(y => `M${g.weight.x} ${y}H${g.weight.x + g.weight.width}`).join('')}
          stroke={trenaPalette.graphite}
          strokeWidth={g.ribs.strokeWidth}
        />
      ) : null}
    </svg>
  );
}

/** Logotipo "PRUMOQ" (Barlow Condensed); o Q é amarelo sobre o grafite. */
export function BrandWordmark({ variant = 'onBrand', className = '' }: { variant?: BrandMarkVariant; className?: string }) {
  const onBrand = variant === 'onBrand';
  return (
    <span
      className={`font-wordmark text-[26px] font-bold leading-none tracking-[0.6px] ${onBrand ? 'text-white' : 'text-txt'} ${className}`}
    >
      PRUMO<span className={onBrand ? 'text-accent' : 'text-txt'}>Q</span>
    </span>
  );
}
