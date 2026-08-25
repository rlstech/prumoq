import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, DataRow, DatumCard, ErrorBanner, ListSurface, MetricBlock } from '../ui';
import { Colors, FontFamily, FontSizes, Spacing, Typography } from '../../lib/constants';

interface Props {
  conformCount: number;
  ncCount: number;
  naCount: number;
  hasNonConformity: boolean;
  /** Full validation error map for the closing step; keys route through
   * stepForError so a tap can jump straight to the offending field. */
  errors: Record<string, string>;
  onFixError: (errorKey: string) => void;
}

/**
 * Asymmetric result hero: the outcome reads first and largest, the three
 * item counts sit secondary — replaces the old row of three identical
 * metric cards, which design-system.md calls out as an anti-pattern.
 */
export function ReviewOutcome({ conformCount, ncCount, naCount, hasNonConformity, errors, onFixError }: Props) {
  const entries = Object.entries(errors);
  return (
    <View style={styles.wrap}>
      <DatumCard tone={hasNonConformity ? 'danger' : 'success'}>
        <View style={styles.hero}>
          <View style={styles.primary}>
            <Text style={styles.overline}>RESULTADO DESTA VERIFICAÇÃO</Text>
            <View style={styles.resultRow}>
              {hasNonConformity
                ? <AlertCircle size={20} color={Colors.nok} />
                : <CheckCircle2 size={20} color={Colors.ok} />}
              <Text style={[styles.resultText, { color: hasNonConformity ? Colors.nok : Colors.ok }]}>
                {hasNonConformity ? 'Não conforme' : 'Conforme'}
              </Text>
            </View>
            <Text style={styles.caption}>Calculado a partir dos itens do checklist.</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.facts}>
            <MetricBlock label="CONFORMES" value={conformCount} tone="success" />
            <MetricBlock label="NC" value={ncCount} tone="danger" />
            <MetricBlock label="N/A" value={naCount} tone="neutral" />
          </View>
        </View>
      </DatumCard>

      {entries.length > 0 ? (
        <View style={styles.pending}>
          <ErrorBanner message="Existem informações obrigatórias pendentes antes do salvamento." />
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

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', minHeight: 80 },
  primary: { flex: 1.5, minWidth: 180, gap: 4 },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  resultText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xl },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
  facts: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  pending: { gap: Spacing.sm },
});
