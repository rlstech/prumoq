import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BorderWidth, Colors, FontFamily, FontSizes, Palette, Spacing } from '../lib/constants';

interface Props {
  value: number;       // 0–100 (concluídos / conforme)
  bgValue?: number;    // 0–100 (iniciados / em andamento) — exibido atrás do fill principal
  height?: number;
  color?: string;
  bgColor?: string;
  showLabel?: boolean;
}

/** Marcas da trena: maiores a cada 10%, menores no meio. */
const TICKS = Array.from({ length: 19 }, (_, i) => (i + 1) * 5);

/**
 * Barra de progresso desenhada como uma trena: fundo branco com borda
 * grafite, preenchimento amarelo e marcas de régua a cada 5%.
 */
export function ProgressBar({
  value,
  bgValue,
  height = 14,
  color = Palette.accent,
  bgColor,
  showLabel = false,
}: Props) {
  const anim = useRef(new Animated.Value(value)).current;
  const bgAnim = useRef(new Animated.Value(bgValue ?? 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 300, useNativeDriver: false }).start();
  }, [value]);

  useEffect(() => {
    Animated.timing(bgAnim, { toValue: bgValue ?? 0, duration: 300, useNativeDriver: false }).start();
  }, [bgValue]);

  const widthPercent = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  const bgWidthPercent = bgAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  return (
    <View style={styles.row}>
      <View style={[styles.track, { height }]}>
        {bgValue !== undefined && bgValue > 0 && (
          <Animated.View style={[styles.fill, { width: bgWidthPercent, backgroundColor: bgColor ?? `${color}55` }]} />
        )}
        <Animated.View style={[styles.fill, { width: widthPercent, backgroundColor: color }]} />
        {TICKS.map(tick => (
          <View
            key={tick}
            style={[
              styles.tick,
              tick % 10 === 0 ? styles.tickMajor : styles.tickMinor,
              { left: `${tick}%` },
            ]}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={styles.label}>{Math.round(value)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  track: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: BorderWidth.card,
    borderColor: Colors.text,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  tick: { position: 'absolute', top: 0, backgroundColor: Colors.text },
  tickMajor: { width: 1.5, height: '50%' },
  tickMinor: { width: 1, height: '28%' },
  label: {
    fontFamily: FontFamily.monoBold,
    fontSize: FontSizes.sm,
    color: Colors.text,
    minWidth: 36,
    textAlign: 'right',
  },
});
