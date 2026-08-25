import { AlertCircle, Check, Circle, ListChecks } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../lib/constants';
import { getRoutePriorityId, type ItemRow, type NcAbertaRow, type Resultado } from './types';

type RouteMode = 'compact' | 'rail';

interface Props {
  items: readonly ItemRow[];
  itemResults: Readonly<Record<string, Resultado>>;
  openNcs: readonly NcAbertaRow[];
  mode: RouteMode;
}

/**
 * A presentation-only locator for the current inspection route. It derives
 * every state from the verification draft, so it cannot diverge from offline
 * data or change the existing checklist controller.
 */
export function ChecklistRouteRail({ items, itemResults, openNcs, mode }: Props) {
  if (items.length === 0) return null;

  const priorityNc = openNcs[0];
  const priorityId = getRoutePriorityId(items, itemResults, openNcs);
  const completed = items.filter(item => !!itemResults[item.id]).length;
  const done = completed === items.length;
  const isCompact = mode === 'compact';

  if (isCompact) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Rota da vistoria: ${completed} de ${items.length} itens classificados`}
        accessibilityValue={{ min: 0, max: items.length, now: completed }}
        style={styles.compact}
      >
        <View style={[styles.doneDatum, !done && styles.doneDatumHidden]} />
        <View style={styles.compactCopy}>
          <ListChecks size={18} color={Colors.brand} strokeWidth={2.2} />
          <View style={styles.compactText}>
            <Text style={styles.compactTitle}>Rota da vistoria</Text>
            <Text numberOfLines={1} style={styles.compactDetail}>
              {priorityNc ? 'Reinspeção prioritária' : done ? 'Checklist concluído' : 'Próximo item pronto'}
            </Text>
          </View>
        </View>
        <Text style={[styles.compactCount, done && styles.countDone]}>{completed}/{items.length}</Text>
        <View style={styles.compactTrack}>
          {items.map(item => <RoutePoint key={item.id} item={item} result={itemResults[item.id]} priorityId={priorityId} compact />)}
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Rota da vistoria: ${completed} de ${items.length} itens classificados`}
      accessibilityValue={{ min: 0, max: items.length, now: completed }}
      style={styles.rail}
    >
      <View style={[styles.doneDatum, !done && styles.doneDatumHidden]} />
      <View style={styles.railHeader}>
        <Text style={styles.railTitle}>Rota da vistoria</Text>
        <Text style={[styles.railCount, done && styles.countDone]}>{completed}/{items.length}</Text>
      </View>
      <Text style={styles.railDescription}>
        {priorityNc ? 'A reinspeção aberta determina a próxima parada.' : 'A sequência acompanha a classificação dos itens.'}
      </Text>
      <View style={styles.railRoute}>
        {items.map(item => <RoutePoint key={item.id} item={item} result={itemResults[item.id]} priorityId={priorityId} />)}
      </View>
    </View>
  );
}

function RoutePoint({
  item,
  result,
  priorityId,
  compact = false,
}: {
  item: ItemRow;
  result?: Resultado;
  priorityId?: string;
  compact?: boolean;
}) {
  const priority = item.id === priorityId;
  const tone = result === 'conforme'
    ? Colors.ok
    : result === 'nao_conforme'
      ? Colors.nok
      : result === 'na'
        ? Colors.na
        : priority
          ? Colors.brandSignature
          : Colors.borderNormal;

  if (compact) {
    return <View style={[styles.compactPoint, { backgroundColor: tone }, priority && styles.compactPointPriority]} />;
  }

  const Icon = result === 'conforme' ? Check : result === 'nao_conforme' ? AlertCircle : Circle;
  const label = result === 'conforme'
    ? 'Conforme'
    : result === 'nao_conforme'
      ? 'Não conforme'
      : result === 'na'
        ? 'N/A'
        : priority
          ? 'Próximo'
          : 'Pendente';

  return (
    <View style={styles.routeRow}>
      <View style={styles.routeLine} />
      <View style={[styles.routeDot, { borderColor: tone }, priority && styles.routeDotPriority]}>
        <Icon size={priority ? 15 : 13} color={tone} strokeWidth={2.4} />
      </View>
      <View style={styles.routeBody}>
        <Text style={[styles.routeOrdinal, priority && { color: Colors.brand }]}>{String(item.ordem).padStart(2, '0')}</Text>
        <Text numberOfLines={2} style={[styles.routeItem, priority && styles.routeItemPriority]}>{item.titulo}</Text>
        <Text style={[styles.routeStatus, { color: tone }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  doneDatum: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: Colors.ok,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  doneDatumHidden: { opacity: 0 },
  countDone: { color: Colors.ok },
  compact: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  compactCopy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  compactText: { flex: 1, gap: 1 },
  compactTitle: { ...Typography.label, color: Colors.text },
  compactDetail: { ...Typography.caption, color: Colors.textSecondary },
  compactCount: { position: 'absolute', top: Spacing.md, right: Spacing.md, fontFamily: FontFamily.monoSemibold, fontSize: FontSizes.sm, color: Colors.brand },
  compactTrack: { flexDirection: 'row', gap: 4 },
  compactPoint: { flex: 1, minWidth: 5, height: 6, borderRadius: Radius.full },
  compactPointPriority: { height: 8, marginTop: -1 },
  rail: {
    position: 'relative',
    overflow: 'hidden',
    width: 224,
    flexShrink: 0,
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  railHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  railTitle: { ...Typography.heading, color: Colors.text, fontSize: FontSizes.lg, lineHeight: 24 },
  railCount: { fontFamily: FontFamily.monoSemibold, fontSize: FontSizes.sm, color: Colors.brand },
  railDescription: { ...Typography.caption, color: Colors.textSecondary },
  railRoute: { marginTop: Spacing.sm, gap: 0 },
  routeRow: { position: 'relative', minHeight: 58, flexDirection: 'row', gap: Spacing.sm },
  routeLine: { position: 'absolute', left: 9, top: 20, bottom: -2, width: 1, backgroundColor: Colors.border },
  routeDot: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 2,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  routeDotPriority: { backgroundColor: Colors.actionSoft, borderWidth: 3 },
  routeBody: { flex: 1, minWidth: 0, paddingBottom: Spacing.sm, gap: 1 },
  routeOrdinal: { fontFamily: FontFamily.mono, fontSize: FontSizes.tiny, color: Colors.textTertiary },
  routeItem: { ...Typography.caption, color: Colors.textSecondary },
  routeItemPriority: { color: Colors.text, fontFamily: FontFamily.semibold },
  routeStatus: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, lineHeight: 16 },
});
