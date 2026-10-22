import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { Palette } from '../lib/constants';

/** Espaço entre as marcas maiores da régua (as menores ficam no meio). */
const RULER_STEP = 18;

/**
 * Fundo da capa do dashboard: grafite chapado, a borda de baixo marcada como
 * uma régua e um prumo de face pendurado à direita, em marca d'água.
 *
 * Fica em `absoluteFill` dentro da capa; a capa é quem define o
 * `overflow: hidden` que recorta este desenho.
 */
export function CanopyBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.face}>
        <Svg width={30} height={72} viewBox="0 0 30 72">
          <Path d="M15 0V30" stroke={Palette.white} strokeOpacity={0.28} strokeWidth={1.2} />
          <Rect x={5} y={30} width={20} height={8} rx={3} fill={Palette.white} fillOpacity={0.22} />
          <Path d="M15 38V46" stroke={Palette.white} strokeOpacity={0.28} strokeWidth={1.2} />
          <Path d="M5 46H25V68Q25 71 22 71H8Q5 71 5 68Z" fill={Palette.accent} fillOpacity={0.85} />
          <Path d="M5 53.5H25M5 61H25" stroke={Palette.brand} strokeWidth={1} />
        </Svg>
      </View>

      <View style={styles.ruler}>
        <Svg width="100%" height={10}>
          <Defs>
            <Pattern id="canopyRuler" width={RULER_STEP} height={10} patternUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={1} height={10} fill={Palette.white} fillOpacity={0.35} />
              <Rect x={RULER_STEP / 2} y={5} width={1} height={5} fill={Palette.white} fillOpacity={0.2} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height={10} fill="url(#canopyRuler)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pendurado abaixo da linha do avatar, terminando antes do card da semana.
  face: { position: 'absolute', top: 58, right: 22 },
  ruler: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10 },
});
