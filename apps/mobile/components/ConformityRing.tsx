import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, FontFamily, FontSizes } from '../lib/constants';

interface Props {
  /** 0–100, ou null quando não houve verificação no período. */
  value: number | null;
  size?: number;
  strokeWidth?: number;
  caption?: string;
}

/**
 * Anel de conformidade do dashboard. O arco varre do azul prumo à cal viva —
 * as duas cores da marca — para que a leitura do progresso seja também a
 * assinatura visual da tela.
 */
export function ConformityRing({
  value,
  size = 78,
  strokeWidth = 8,
  caption = 'conformes',
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (circumference * percentage) / 100;
  const center = size / 2;

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
        <Defs>
          <LinearGradient id="conformityRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={Colors.brand} />
            <Stop offset="1" stopColor={Colors.brandSignature} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {value === null ? null : (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#conformityRing)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
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
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xl,
    lineHeight: 26,
    letterSpacing: -0.7,
    color: Colors.text,
  },
  caption: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    lineHeight: 12,
    color: Colors.textTertiary,
  },
});
