import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../lib/constants';

interface Props {
  value: number;       // 0–100
  height?: number;
  color?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, height = 6, color = Colors.brand, showLabel = false }: Props) {
  const anim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const widthPercent = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.row}>
      <View style={[styles.track, { height }]}>
        <Animated.View style={[styles.fill, { width: widthPercent, backgroundColor: color, height }]} />
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
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    minWidth: 28,
    textAlign: 'right',
  },
});
