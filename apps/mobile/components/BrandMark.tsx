import { prumoSymbolGeometry } from '@prumoq/design-system';
import { Circle, Path, Svg } from 'react-native-svg';
import { Colors, Palette } from '../lib/constants';

export type BrandMarkVariant = 'default' | 'onBrand';

interface Props {
  size?: number;
  variant?: BrandMarkVariant;
}

export function BrandMark({ size = 40, variant = 'default' }: Props) {
  const onBrand = variant === 'onBrand';
  const ringColor = onBrand ? Colors.brandSignature : Colors.brand;
  const cordColor = onBrand ? Palette.white : Colors.brand;
  const weightColor = onBrand ? Palette.white : Colors.brandSignature;
  const weightOutline = onBrand ? Colors.brand : Colors.surface;
  const geometry = prumoSymbolGeometry;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={geometry.viewBox}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={geometry.ring.cx}
        cy={geometry.ring.cy}
        r={geometry.ring.radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={geometry.ring.strokeWidth}
      />
      <Path
        d={geometry.tailPath}
        fill="none"
        stroke={ringColor}
        strokeWidth={geometry.tailStrokeWidth}
        strokeLinecap="round"
      />
      <Path
        d={geometry.cordPath}
        fill="none"
        stroke={cordColor}
        strokeWidth={geometry.cordStrokeWidth}
        strokeLinecap="round"
      />
      <Path
        d={geometry.weightPath}
        fill={weightColor}
        stroke={weightOutline}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
