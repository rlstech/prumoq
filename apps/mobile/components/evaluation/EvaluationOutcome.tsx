import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, BadgeTone, DataRow, DatumCard, ErrorBanner, ListSurface, MetricBlock } from '../ui';
import { Colors, FontFamily, FontSizes, Spacing, Typography } from '../../lib/constants';

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
 * Asymmetric result hero: the percentage reads first and largest, the counts
 * sit secondary — rather than a row of identical metric cards, which
 * design-system.md calls out as an anti-pattern.
 *
 * The percentage shown here is a preview. `pontos_obtidos`, `pontos_possiveis`
 * and `percentual` are recomputed by the `finalizar_avaliacao_empreiteiro`
 * trigger when the evaluation is concluded, and that is the value of record.
 */
export function EvaluationOutcome({ score, total, metCount, unmetCount, errors, onFixError }: Props) {
  const entries = Object.entries(errors);
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const tone: BadgeTone = unmetCount === 0 ? 'success' : percent >= 70 ? 'warning' : 'danger';
  const label = unmetCount === 0
    ? 'Todos os critérios atendidos'
    : `${unmetCount} ${unmetCount === 1 ? 'critério não atendido' : 'critérios não atendidos'}`;

  return (
    <View style={styles.wrap}>
      <DatumCard tone={tone}>
        <View style={styles.hero}>
          <View style={styles.primary}>
            <Text style={styles.overline}>RESULTADO DESTA AVALIAÇÃO</Text>
            <View style={styles.resultRow}>
              <Text style={[styles.percent, { color: metricColor[tone] }]}>{percent}</Text>
              <Text style={[styles.percentSuffix, { color: metricColor[tone] }]}>%</Text>
            </View>
            <Badge
              tone={tone}
              size="sm"
              label={label}
              Icon={unmetCount === 0 ? CheckCircle2 : AlertCircle}
            />
            <Text style={styles.caption}>Prévia — o valor final é calculado ao concluir.</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.facts}>
            <MetricBlock label="ATENDE" value={metCount} tone="success" />
            <MetricBlock label="NÃO ATENDE" value={unmetCount} tone="danger" />
            <MetricBlock label="PONTOS" value={score} suffix={`/${total}`} tone="neutral" />
          </View>
        </View>
      </DatumCard>

      {entries.length > 0 ? (
        <View style={styles.pending}>
          <ErrorBanner message="Existem informações obrigatórias pendentes antes de concluir." />
          <ListSurface>
            {entries.map(([key, message], index) => (
              <DataRow
                key={key}
                label={message}
                value="Corrigir"
                onPress={() => onFixError(key)}
                accessibilityLabel={`Corrigir: ${message}`}
                trailing={<ChevronRight size={18} color={Colors.brand} />}
                last={index === entries.length - 1}
              />
            ))}
          </ListSurface>
        </View>
      ) : (
        <Badge tone="success" size="sm" label="Preenchimento completo" Icon={CheckCircle2} />
      )}
    </View>
  );
}

const metricColor: Record<BadgeTone, string> = {
  neutral: Colors.text,
  brand: Colors.brand,
  success: Colors.ok,
  danger: Colors.nok,
  warning: Colors.warn,
  info: Colors.info,
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', minHeight: 80 },
  primary: { flex: 1.5, minWidth: 180, gap: Spacing.xs, alignItems: 'flex-start' },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  percent: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.title,
    lineHeight: 40,
    letterSpacing: -1.2,
  },
  percentSuffix: { fontFamily: FontFamily.mono, fontSize: FontSizes.md, lineHeight: 24 },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
  facts: { flex: 1, gap: Spacing.md },
  pending: { gap: Spacing.sm },
});
