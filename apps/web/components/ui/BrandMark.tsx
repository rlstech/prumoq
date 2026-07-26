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

export function BrandMark({ size = 40, variant = 'onBrand', className }: Props) {
  const onBrand = variant === 'onBrand';
  const ringColor = onBrand ? mineralColors.accent : mineralColors.brand;
  const cordColor = onBrand ? mineralPalette.mineralWhite : mineralColors.brand;
  const weightColor = onBrand ? mineralPalette.mineralWhite : mineralColors.accent;
  const weightOutline = onBrand ? mineralColors.brand : mineralColors.surface;
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
        d={geometry.tailPath}
        stroke={ringColor}
        strokeWidth={geometry.tailStrokeWidth}
        strokeLinecap="round"
      />
      <path
        d={geometry.cordPath}
        stroke={cordColor}
        strokeWidth={geometry.cordStrokeWidth}
        strokeLinecap="round"
      />
      <path
        d={geometry.weightPath}
        fill={weightColor}
        stroke={weightOutline}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}
