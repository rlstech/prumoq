import { AlertCircle, CheckCircle2, ChevronRight, XCircle } from '../../lib/icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconTile, Pill } from '../ui';
import { Colors, FontFamily, FontSizes, Radius, Spacing } from '../../lib/constants';

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
 * Resultado da verificação (Trena Suave): o veredito primeiro e grande, as
 * contagens em pílulas logo abaixo, e as pendências como linhas tocáveis que
 * levam direto ao campo.
 */
export function ReviewOutcome({ conformCount, ncCount, naCount, hasNonConformity, errors, onFixError }: Props) {
  const entries = Object.entries(errors);
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.hero}>
          <IconTile Icon={hasNonConformity ? XCircle : CheckCircle2} tone={hasNonConformity ? 'danger' : 'success'} size={56} />
          <View style={styles.heroText}>
            <Text style={styles.label}>Resultado desta verificação</Text>
            <Text style={[styles.result, { color: hasNonConformity ? Colors.nok : Colors.ok }]}>
              {hasNonConformity ? 'Não conforme' : 'Conforme'}
            </Text>
          </View>
        </View>
        <View style={styles.pills}>
          <Pill label={`${conformCount} conforme${conformCount === 1 ? '' : 's'}`} tone="success" dot />
          <Pill label={`${ncCount} NC`} tone={ncCount > 0 ? 'danger' : 'neutral'} dot onSurface />
          <Pill label={`${naCount} N/A`} tone="neutral" dot onSurface />
        </View>
        <Text style={styles.caption}>Calculado a partir dos itens do checklist.</Text>
      </View>

      {entries.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.pendingHead}>
            <AlertCircle size={18} color={Colors.nok} />
            <Text style={styles.pendingTitle}>Falta preencher antes de salvar</Text>
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
        <Pill label="Preenchimento completo" tone="success" Icon={CheckCircle2} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  heroText: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Colors.textSecondary },
  result: { fontFamily: FontFamily.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
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
