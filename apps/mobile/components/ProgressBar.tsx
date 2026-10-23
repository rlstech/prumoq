import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSizes, Palette, Radius, Spacing } from '../lib/constants';

interface Props {
  value: number;       // 0–100 (concluídos / conforme)
  bgValue?: number;    // 0–100 (iniciados / em andamento) — exibido atrás do fill principal
  height?: number;
  color?: string;
  bgColor?: string;
  /** Fundo da fita; no cartão amarelo usar um grafite translúcido. */
  trackColor?: string;
  /** Cor das marcas de régua. */
  tickColor?: string;
  showLabel?: boolean;
}

/** Marcas da trena: maiores a cada 10%, menores no meio. */
const TICKS = Array.from({ length: 19 }, (_, i) => (i + 1) * 5);

/**
 * Barra de progresso como uma fita de trena (Trena Suave): pílula sem borda,
 * preenchimento arredondado e marcas de régua discretas a cada 5%.
 */
export function ProgressBar({
  value,
  bgValue,
  height = 14,
  color = Palette.accent,
  bgColor,
  trackColor = Colors.surface2,
  tickColor = 'rgba(28, 31, 34, 0.28)',
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
      <View style={[styles.track, { height, backgroundColor: trackColor }]}>
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
              { left: `${tick}%`, backgroundColor: tickColor },
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
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: Radius.full },
  tick: { position: 'absolute', top: '25%' },
  tickMajor: { width: 1.5, height: '50%' },
  tickMinor: { width: 1, height: '30%', top: '35%' },
  label: {
    fontFamily: FontFamily.monoBold,
    fontSize: FontSizes.sm,
    color: Colors.text,
    minWidth: 36,
    textAlign: 'right',
  },
});
