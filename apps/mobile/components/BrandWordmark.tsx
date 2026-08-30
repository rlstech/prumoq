import { Text } from 'react-native';
import { Colors, FontFamily, Palette } from '../lib/constants';

interface Props {
  fontSize?: number;
  variant?: 'default' | 'onBrand';
}

/**
 * Logotipo PrumoQ. O símbolo do prumo agora vive na [BrandMark]; o logotipo
 * ficou tipográfico puro, sem o rabo diagonal no Q, para não repetir o mesmo
 * gesto duas vezes no cabeçalho.
 */
export function BrandWordmark({ fontSize = 16, variant = 'default' }: Props) {
  const color = variant === 'onBrand' ? Palette.white : Colors.brand;

  return (
    <Text
      accessible
      accessibilityRole="text"
      accessibilityLabel="PrumoQ"
      style={{
        fontFamily: FontFamily.semibold,
        fontSize,
        lineHeight: Math.round(fontSize * 1.2),
        letterSpacing: -0.3,
        color,
      }}
    >
      PrumoQ
    </Text>
  );
}
