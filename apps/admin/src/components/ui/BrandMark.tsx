import {
  mineralColors,
  mineralPalette,
  prumoSymbolGeometry,
} from '@prumoq/design-system';

type BrandMarkVariant = 'default' | 'onBrand';

interface Props {
  size?: number;
  variant?: BrandMarkVariant;
  className?: string;
}

/**
 * Marca PrumoQ — o fio de prumo desce do contorno do "O" e termina no peso em
 * cal viva. Mesma geometria do símbolo no app mobile: os números vivem em
 * `prumoSymbolGeometry`, no design system, para as duas plataformas não
 * divergirem.
 */
export function BrandMark({ size = 40, variant = 'onBrand', className }: Props) {
  const onBrand = variant === 'onBrand';
  const ringColor = onBrand ? mineralPalette.mineralWhite : mineralColors.brand;
  const cordColor = onBrand ? mineralColors.accent : mineralColors.brand;
  const weightColor = mineralColors.accent;
  const geometry = prumoSymbolGeometry;

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox={geometry.viewBox}
      fill="none"
    >
      <circle
        cx={geometry.ring.cx}
        cy={geometry.ring.cy}
        r={geometry.ring.radius}
        stroke={ringColor}
        strokeWidth={geometry.ring.strokeWidth}
      />
      <path
        d={geometry.cordPath}
        stroke={cordColor}
        strokeWidth={geometry.cord.strokeWidth}
        strokeLinecap="round"
      />
      {/* Sobre fundo claro o peso ganha contorno para não sumir no calcário. */}
      <path
        d={geometry.weightPath}
        fill={weightColor}
        stroke={onBrand ? 'none' : mineralColors.brand}
        strokeWidth={onBrand ? 0 : 0.9}
        strokeLinejoin="round"
      />
    </svg>
  );
}
