import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Palette } from '../lib/constants';

interface Props {
  fontSize?: number;
  variant?: 'default' | 'onBrand';
}

export function BrandWordmark({ fontSize = 16, variant = 'default' }: Props) {
  const color = variant === 'onBrand' ? Palette.white : Colors.brand;
  const lineHeight = Math.round(fontSize * 1.2);

  return (
    <View
      accessible
      accessibilityLabel="PrumoQ"
      style={styles.row}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.text, { color, fontSize, lineHeight }]}
      >
        Prumo
      </Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: fontSize * 0.73, height: lineHeight }}
      >
        <Text style={[styles.text, styles.q, { color, fontSize, lineHeight }]}>O</Text>
        <View
          style={[
            styles.tail,
            {
              width: fontSize * 0.43,
              height: Math.max(2, fontSize * 0.16),
              right: -fontSize * 0.06,
              bottom: fontSize * 0.08,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontFamily: FontFamily.bold,
    letterSpacing: -0.25,
  },
  q: {
    position: 'absolute',
    inset: 0,
  },
  tail: {
    position: 'absolute',
    backgroundColor: Colors.brandSignature,
    transform: [{ rotate: '45deg' }],
  },
});
