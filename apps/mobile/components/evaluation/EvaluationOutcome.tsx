import { AlertCircle, CheckCircle2, ChevronRight } from '../../lib/icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pill, type TrenaTone } from '../ui';
import { Colors, FontFamily, FontSizes, Radius, Spacing } from '../../lib/constants';

interface Props {
  score: number;
  total: number;
  metCount: number;
  unmetCount: number;
  /** Full validation error map; keys route through `stepForError` so a tap can
   * jump straight to the offending field. */
  errors: Record<string, string>;
  onFixError: (errorKey: string) => void;
}

/**
 * Resultado da avaliação (Trena Suave): o percentual primeiro e grande, as
 * contagens em pílulas e as pendências como linhas tocáveis.
 *
 * The percentage shown here is a preview. `pontos_obtidos`, `pontos_possiveis`
 * and `percentual` are recomputed by the `finalizar_avaliacao_empreiteiro`
 * trigger when the evaluation is concluded, and that is the value of record.
 */
export function EvaluationOutcome({ score, total, metCount, unmetCount, errors, onFixError }: Props) {
  const entries = Object.entries(errors);
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const tone: TrenaTone = unmetCount === 0 ? 'success' : percent >= 70 ? 'warning' : 'danger';
  const color = tone === 'success' ? Colors.ok : tone === 'warning' ? Colors.warn : Colors.nok;
  const label = unmetCount === 0
    ? 'Todos os critérios atendidos'
    : `${unmetCount} ${unmetCount === 1 ? 'critério não atendido' : 'critérios não atendidos'}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.label}>Resultado desta avaliação</Text>
        <View style={styles.resultRow}>
          <Text style={[styles.percent, { color }]}>{percent}</Text>
          <Text style={[styles.percentSuffix, { color }]}>%</Text>
        </View>
        <Pill tone={tone} label={label} Icon={unmetCount === 0 ? CheckCircle2 : AlertCircle} />
        <View style={styles.pills}>
          <Pill label={`${metCount} atende`} tone="success" dot />
          <Pill label={`${unmetCount} não atende`} tone={unmetCount > 0 ? 'danger' : 'neutral'} dot onSurface />
          <Pill label={`${score}/${total} pontos`} tone="neutral" mono onSurface />
        </View>
        <Text style={styles.caption}>Prévia: o valor final é calculado ao concluir.</Text>
      </View>

      {entries.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.pendingHead}>
            <AlertCircle size={18} color={Colors.nok} />
            <Text style={styles.pendingTitle}>Falta preencher antes de concluir</Text>
          </View>
          {entries.map(([key, message]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Corrigir: ${message}`}
              onPress={() => onFixError(key)}
              style={({ pressed }) => [styles.pendingRow, pressed && styles.pressed]}
            >
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText} numberOfLines={2}>{message}</Text>
              <Text style={styles.fix}>Corrigir</Text>
              <ChevronRight size={16} color={Colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Pill tone="success" label="Preenchimento completo" Icon={CheckCircle2} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  label: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Colors.textSecondary },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: -4 },
  percent: { fontFamily: FontFamily.display, fontSize: 56, lineHeight: 62, letterSpacing: -2 },
  percentSuffix: { fontFamily: FontFamily.bold, fontSize: 22 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  caption: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, color: Colors.textTertiary },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pendingTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.sm, color: Colors.nok },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
  },
  pendingDot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.nok },
  pendingText: { flex: 1, minWidth: 0, fontFamily: FontFamily.medium, fontSize: FontSizes.sm, color: Colors.text },
  fix: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Colors.textSecondary },
  pressed: { opacity: 0.7 },
});
