import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';

interface Props {
  value: number;       // 0–100 (concluídos / conforme)
  bgValue?: number;    // 0–100 (iniciados / em andamento) — exibido atrás do fill principal
  height?: number;
  color?: string;
  bgColor?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, bgValue, height = 6, color = Colors.brand, bgColor, showLabel = false }: Props) {
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
          <Animated.View style={[styles.fill, { width: bgWidthPercent, backgroundColor: bgColor ?? `${color}40`, height, position: 'absolute', top: 0, left: 0 }]} />
        )}
        <Animated.View style={[styles.fill, { width: widthPercent, backgroundColor: color, height, position: 'absolute', top: 0, left: 0 }]} />
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
    gap: Spacing.xs,
  },
  track: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: Radius.sm,
  },
  label: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    minWidth: 28,
    textAlign: 'right',
  },
});
