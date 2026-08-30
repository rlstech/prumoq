import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../lib/constants';

/**
 * Fundo da capa do dashboard: degradê azul prumo, dois halos de cal viva e o
 * fio de prumo em marca d'água à direita — o mesmo gesto da [BrandMark], em
 * escala de cenário.
 *
 * Fica em `absoluteFill` dentro da capa; a capa é quem define o raio inferior
 * e o `overflow: hidden` que recorta este desenho.
 */
export function CanopyBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 390 240">
        <Defs>
          <LinearGradient id="canopyBase" x1="0.12" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={Colors.brand} />
            <Stop offset="0.55" stopColor={Colors.brand} />
            <Stop offset="1" stopColor={Colors.brandDark} />
          </LinearGradient>
          <RadialGradient id="canopyGlowTop" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={Colors.brandSignature} stopOpacity="0.26" />
            <Stop offset="1" stopColor={Colors.brandSignature} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="canopyGlowBottom" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={Colors.brandSignature} stopOpacity="0.10" />
            <Stop offset="1" stopColor={Colors.brandSignature} stopOpacity="0" />
          </RadialGradient>
          {/* O fio nasce invisível e só aparece abaixo da linha do avatar e da
              pastilha de sync: sem isso ele corta o espaço entre os dois
              controles e lê como risco solto, não como marca d'água. */}
          <LinearGradient id="canopyPlumbLine" gradientUnits="userSpaceOnUse" x1="330" y1="0" x2="330" y2="152">
            <Stop offset="0" stopColor={Colors.brandSignature} stopOpacity="0" />
            <Stop offset="0.5" stopColor={Colors.brandSignature} stopOpacity="0" />
            <Stop offset="1" stopColor={Colors.brandSignature} stopOpacity="0.34" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="390" height="240" fill="url(#canopyBase)" />
        <Rect x="216" y="-96" width="250" height="250" fill="url(#canopyGlowTop)" />
        <Rect x="-80" y="100" width="280" height="280" fill="url(#canopyGlowBottom)" />

        <Path
          d="M330 0 V152"
          stroke="url(#canopyPlumbLine)"
          strokeWidth="1.2"
          strokeDasharray="3 5"
        />
        <Path
          d="M330 152 L337 163 L330 180 L323 163 Z"
          fill={Colors.brandSignature}
          opacity="0.26"
        />
      </Svg>
    </View>
  );
}
