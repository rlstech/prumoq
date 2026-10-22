import { faceSymbolGeometry } from '@prumoq/design-system';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Palette } from '../lib/constants';

export type BrandMarkVariant = 'default' | 'onBrand';

interface Props {
  size?: number;
  /** 'onBrand' = sobre o grafite (Q, fio e taco brancos). */
  variant?: BrandMarkVariant;
  /** Desenha o ladrilho grafite de ícone de app em volta da marca. */
  tile?: boolean;
}

/** A partir deste tamanho os frisos do peso aparecem; abaixo viram ruído. */
const RIBS_FROM = 40;

const { ring, cordTop, taco, cordBottom, weight, ribs, weightPath, fittedViewBox } = faceSymbolGeometry;

/**
 * Marca PrumoQ "Q de face": o Q com um prumo de face pendurado no lugar da
 * perninha. A geometria vem de `faceSymbolGeometry` (design system), a mesma
 * usada pelo gerador dos ícones do app.
 */
export function BrandMark({ size = 40, variant = 'default', tile = false }: Props) {
  const onBrand = tile || variant === 'onBrand';
  const ink = onBrand ? Palette.white : Palette.ink;
  const glyphSize = tile ? size * 0.74 : size;
  const showRibs = glyphSize >= RIBS_FROM;

  const glyph = (
    <Svg width={glyphSize} height={glyphSize} viewBox={fittedViewBox}>
      <Circle cx={ring.cx} cy={ring.cy} r={ring.radius} fill="none" stroke={ink} strokeWidth={ring.strokeWidth} />
      <Path d={`M${cordTop.x} ${cordTop.top}V${cordTop.bottom}`} stroke={ink} strokeWidth={cordTop.strokeWidth} />
      <Rect x={taco.x} y={taco.y} width={taco.width} height={taco.height} rx={taco.radius} fill={ink} />
      <Path d={`M${cordBottom.x} ${cordBottom.top}V${cordBottom.bottom}`} stroke={ink} strokeWidth={cordBottom.strokeWidth} />
      <Path d={weightPath} fill={Palette.accent} />
      {showRibs
        ? ribs.y.map((y) => (
            <Path
              key={y}
              d={`M${weight.x} ${y}H${weight.x + weight.width}`}
              stroke={Palette.onAccent}
              strokeWidth={ribs.strokeWidth}
            />
          ))
        : null}
    </Svg>
  );

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
        tile && { borderRadius: size * 0.2, backgroundColor: Palette.brand },
      ]}
    >
      {glyph}
    </View>
  );
}
