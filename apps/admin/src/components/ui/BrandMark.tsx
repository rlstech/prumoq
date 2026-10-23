import { faceSymbolGeometry, trenaPalette } from '@prumoq/design-system';

type BrandMarkVariant = 'default' | 'onBrand';

interface Props {
  size?: number;
  variant?: BrandMarkVariant;
  className?: string;
}

/** A partir deste tamanho os frisos do peso aparecem; abaixo viram ruído. */
const RIBS_FROM = 40;

const { ring, cordTop, taco, cordBottom, weight, ribs, weightPath, fittedViewBox } = faceSymbolGeometry;

/**
 * Marca PrumoQ "Q de face" (mesma do PWA): o Q com um prumo de face no lugar
 * da perninha. A geometria vem de `faceSymbolGeometry`, no design system.
 * 'onBrand' = sobre fundo escuro (Q, fio e taco brancos); o peso é sempre amarelo trena.
 */
export function BrandMark({ size = 40, variant = 'onBrand', className }: Props) {
  const ink = variant === 'onBrand' ? trenaPalette.white : trenaPalette.graphite;

  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox={fittedViewBox} fill="none">
      <circle cx={ring.cx} cy={ring.cy} r={ring.radius} stroke={ink} strokeWidth={ring.strokeWidth} />
      <path
        d={`M${cordTop.x} ${cordTop.top}V${cordTop.bottom}M${cordBottom.x} ${cordBottom.top}V${cordBottom.bottom}`}
        stroke={ink}
        strokeWidth={cordTop.strokeWidth}
      />
      <rect x={taco.x} y={taco.y} width={taco.width} height={taco.height} rx={taco.radius} fill={ink} />
      <path d={weightPath} fill={trenaPalette.tapeYellow} />
      {size >= RIBS_FROM
        ? ribs.y.map((y) => (
            <path
              key={y}
              d={`M${weight.x} ${y}H${weight.x + weight.width}`}
              stroke={trenaPalette.graphite}
              strokeWidth={ribs.strokeWidth}
            />
          ))
        : null}
    </svg>
  );
}
