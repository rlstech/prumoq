import { prumoSymbolGeometry } from '@prumoq/design-system';
import { View } from 'react-native';
import { Colors, Palette } from '../lib/constants';

export type BrandMarkVariant = 'default' | 'onBrand';

interface Props {
  size?: number;
  variant?: BrandMarkVariant;
  /** Envolve a marca no ladrilho arredondado (leitura de ícone de app). */
  tile?: boolean;
}

/** Abaixo deste tamanho o peso do prumo vira sólido: a cal viva não tem
 *  contraste suficiente contra o azul em poucos pixels. */
const SOLID_BOB_BELOW = 20;

const { grid, ring, cord, weight, visualBounds } = prumoSymbolGeometry;

/** Quanto o centro óptico da marca fica abaixo do centro da caixa. */
const OPTICAL_OFFSET = (visualBounds.top + visualBounds.bottom) / 2 - grid / 2;

/** O losango do peso é desenhado como quadrado rotacionado 45°: o lado sai da
 *  média das duas diagonais do losango canônico. */
const WEIGHT_SIDE = (weight.halfWidth + weight.halfHeight) / Math.SQRT2;

/**
 * Marca PrumoQ — o fio de prumo desce do contorno do "O" e termina no peso em
 * cal viva. Desenhada com Views (sem SVG e sem bitmap) para renderizar igual no
 * nativo e no PWA e escalar sem asset por densidade.
 *
 * A geometria vem de `prumoSymbolGeometry` (design system), a mesma que o
 * `BrandMark` do painel admin desenha em SVG.
 */
export function BrandMark({ size = 40, variant = 'default', tile = false }: Props) {
  const glyphSize = tile ? size * 0.78 : size;
  const onBrand = variant === 'onBrand';
  const u = glyphSize / grid;

  const strokeColor = onBrand ? Palette.white : Colors.brand;
  const solidBob = glyphSize < SOLID_BOB_BELOW;
  const bobColor = solidBob && !onBrand ? Colors.brand : Colors.brandSignature;

  const ringStroke = Math.max(1.4, ring.strokeWidth * u);
  const ringBox = ring.radius * 2 * u + ringStroke;
  const cordWidth = Math.max(1.2, cord.strokeWidth * u);
  const bobSide = WEIGHT_SIDE * u;

  const glyph = (
    <View
      style={[
        { width: glyphSize, height: glyphSize },
        // Dentro do ladrilho a marca sobe até o centro óptico para não
        // parecer afundada.
        tile && { transform: [{ translateY: -OPTICAL_OFFSET * u }] },
      ]}
      accessible={false}
    >
      <View
        style={{
          position: 'absolute',
          left: ring.cx * u - ringBox / 2,
          top: ring.cy * u - ringBox / 2,
          width: ringBox,
          height: ringBox,
          borderRadius: ringBox / 2,
          borderWidth: ringStroke,
          borderColor: strokeColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: cord.x * u - cordWidth / 2,
          top: cord.top * u,
          width: cordWidth,
          height: (cord.bottom - cord.top) * u,
          borderRadius: cordWidth / 2,
          backgroundColor: onBrand ? Colors.brandSignature : strokeColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: weight.cx * u - bobSide / 2,
          top: weight.cy * u - bobSide / 2,
          width: bobSide,
          height: bobSide,
          backgroundColor: bobColor,
          borderWidth: !onBrand && !solidBob ? Math.max(0.8, 0.9 * u) : 0,
          borderColor: Colors.brand,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );

  if (!tile) return glyph;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onBrand ? 'rgba(255,255,255,0.10)' : Colors.surface,
        borderWidth: 1,
        borderColor: onBrand ? 'rgba(216,229,104,0.55)' : Colors.border,
      }}
    >
      {glyph}
    </View>
  );
}
