import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, FontFamily, Palette } from '../lib/constants';

interface Props {
  /** 0–100, ou null quando não houve verificação no período. */
  value: number | null;
  size?: number;
  strokeWidth?: number;
  caption?: string;
}

/** Marcas do mostrador em volta do arco (uma a cada 5%). */
const TICKS = 20;
const TICK_STROKE = 3;
const GAP = 1;

/**
 * Anel de conformidade do dashboard, desenhado como um mostrador: arco em
 * amarelo trena e marcas de régua em volta, a cada 5%.
 */
export function ConformityRing({
  value,
  size = 80,
  strokeWidth = 10,
  caption = 'conformes',
}: Props) {
  const center = size / 2;
  const tickRadius = center - TICK_STROKE / 2;
  const arcRadius = tickRadius - TICK_STROKE / 2 - GAP - strokeWidth / 2;
  const innerRadius = arcRadius - strokeWidth / 2 - 0.75;
  const arcLength = 2 * Math.PI * arcRadius;
  const tickSlot = (2 * Math.PI * tickRadius) / TICKS;
  const percentage = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (arcLength * percentage) / 100;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        value === null
          ? 'Sem verificações nos últimos 7 dias'
          : `${Math.round(percentage)} por cento das verificações conformes`
      }
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={arcRadius} stroke={Colors.bg} strokeWidth={strokeWidth} fill="none" />
        {value === null || percentage === 0 ? null : (
          <Circle
            cx={center}
            cy={center}
            r={arcRadius}
            stroke={Palette.accent}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${arcLength}`}
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
        <Circle
          cx={center}
          cy={center}
          r={tickRadius}
          stroke={Colors.text}
          strokeWidth={TICK_STROKE}
          strokeDasharray={`1.2 ${tickSlot - 1.2}`}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
        <Circle cx={center} cy={center} r={innerRadius} stroke={Colors.text} strokeWidth={1.5} fill="none" />
      </Svg>
      <View style={styles.label} pointerEvents="none">
        <Text style={styles.value}>{value === null ? '—' : `${Math.round(percentage)}%`}</Text>
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: FontFamily.monoBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  caption: {
    fontFamily: FontFamily.semibold,
    fontSize: 9,
    lineHeight: 11,
    color: Colors.textSecondary,
  },
});
