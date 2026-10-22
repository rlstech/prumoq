import { Text } from 'react-native';
import { FontFamily, Palette } from '../lib/constants';

interface Props {
  fontSize?: number;
  variant?: 'default' | 'onBrand';
}

/**
 * Logotipo PRUMOQ em Barlow Condensed. Sobre o grafite o Q fica em amarelo
 * trena; sobre fundo claro tudo em grafite (amarelo não tem contraste ali).
 */
export function BrandWordmark({ fontSize = 18, variant = 'default' }: Props) {
  const onBrand = variant === 'onBrand';
  const color = onBrand ? Palette.white : Palette.ink;

  return (
    <Text
      accessible
      accessibilityRole="text"
      accessibilityLabel="PrumoQ"
      style={{
        fontFamily: FontFamily.display,
        fontSize,
        lineHeight: Math.round(fontSize * 1.1),
        letterSpacing: fontSize * 0.02,
        textTransform: 'uppercase',
        color,
      }}
    >
      Prumo
      <Text style={{ color: onBrand ? Palette.accent : color }}>Q</Text>
    </Text>
  );
}
