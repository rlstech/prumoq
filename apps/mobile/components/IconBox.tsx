import { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

/**
 * Ícone Lucide dentro de uma caixa de tamanho declarado.
 *
 * `lucide-react-native` repassa `size` como props `width`/`height` do `<Svg>`.
 * Sob a Nova Arquitetura o `react-native-svg` acaba informando ao Yoga um
 * tamanho intrínseco diferente do que pinta, e o texto vizinho na mesma linha
 * recebe menos largura do que existe — foi assim que "SUAS OBRAS" virou "SUAS"
 * com 350dp livres à direita, e "Vencem hoje" virou "Vencem ho…".
 *
 * Envolver o SVG num `View` com largura e altura explícitas e `flexShrink: 0`
 * tira a medição das mãos do SVG: o Yoga passa a usar a caixa, o ícone pinta
 * dentro dela, e o texto ao lado fica com todo o resto da linha.
 */
export function IconBox({
  icon: LucideGlyph,
  size,
  color,
  strokeWidth = 2,
}: {
  icon: LucideIcon;
  size: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <LucideGlyph size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
