import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, LockKeyhole, MinusCircle, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, ResultToggle } from '../ui';
import { Colors, ComponentSize, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../lib/constants';
import { ItemRow, Resultado } from './types';

interface Props {
  item: ItemRow;
  result?: Resultado;
  onResultChange: (result: Resultado) => void;
  /** Reinspection mode, item without an open NC: kept from the previous
   * verification and not re-editable in this pass. */
  locked: boolean;
  /** This item is the one under reinspection right now (open NC). */
  isNcItem: boolean;
  /** The single stop the inspector should be looking at, derived once by
   * `getRoutePriorityId` so this row and the route rail always agree. */
  isPriority?: boolean;
  itemError?: string;
  last?: boolean;
  /** Opens the NC sheet for this item. The NC form no longer expands in place:
   * it used to push every following item down the page and cost the inspector
   * their position in the list. */
  onOpenNc: () => void;
  /** All five required NC fields plus the photo are filled. */
  ncComplete?: boolean;
  ncError?: string;
}

/** Width of the ordinal gutter. Title and method line hang off the same
 * vertical axis — the "linha de controle" that gives the design system its
 * name. The result control deliberately breaks out of it to use the full row
 * width, which is what makes three equal 56pt targets fit. */
const GUTTER = 26;

const resultBadge: Record<Resultado, { label: string; tone: 'success' | 'danger' | 'neutral'; Icon: typeof CheckCircle2 }> = {
  conforme: { label: 'Conforme', tone: 'success', Icon: CheckCircle2 },
  nao_conforme: { label: 'Não conforme', tone: 'danger', Icon: XCircle },
  na: { label: 'N/A', tone: 'neutral', Icon: MinusCircle },
};

/** One checklist row. Unanswered it shows ordinal + title, a collapsible
 * method/tolerance line and the tri-state result control. Answered it collapses
 * to a single 56pt line carrying the status badge, so a thirty-item FVS stays
 * scannable instead of running to six screens of scroll. Tapping a collapsed
 * row reopens it; tapping a não conforme row reopens the NC sheet. */
export function ChecklistItemRow({
  item,
  result,
  onResultChange,
  locked,
  isNcItem,
  isPriority = false,
  itemError,
  last = false,
  onOpenNc,
  ncComplete = false,
  ncError,
}: Props) {
  const [methodExpanded, setMethodExpanded] = useState(false);
  const [reopened, setReopened] = useState(false);
  const hasMethodInfo = !!(item.metodo_verif || item.tolerancia);

  const isNok = result === 'nao_conforme';
  const semanticColor = isNok || isNcItem
    ? Colors.nok
    : result === 'conforme'
      ? Colors.ok
      : result === 'na'
        ? Colors.na
        : null;

  // Answered rows carry a full-bleed spine so the left edge of the list reads
  // as a progress map at arm's length; pending rows keep a short inset tick.
  const answered = !!semanticColor;
  const collapsed = answered && !reopened;
  // An open NC or an answered item already carries a semantic colour, and
  // design-system.md gives that priority over the Cal Viva focus marker.
  const showPriority = isPriority && !answered;
  const datumColor = semanticColor ?? (showPriority ? Colors.brandSignature : Colors.border);
  const ordinalColor = semanticColor ?? (showPriority ? Colors.brand : Colors.textTertiary);

  // A NC that still needs its five fields is the one thing worth pulling the
  // inspector back into, so it takes the row's tap over merely reopening it.
  const ncPending = isNok && !isNcItem && !ncComplete;

  function handleResult(value: Resultado) {
    setReopened(false);
    onResultChange(value);
  }

  function handleCollapsedPress() {
    if (locked) return;
    if (ncPending) {
      onOpenNc();
      return;
    }
    setReopened(true);
  }

  const badge = result ? resultBadge[result] : null;

  return (
    <View style={[styles.row, !last && styles.rowBordered]}>
      <View
        style={[
          styles.datum,
          answered ? styles.datumAnswered : styles.datumPending,
          { backgroundColor: datumColor },
        ]}
      />

      {collapsed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Item ${item.ordem}: ${item.titulo}. ${badge?.label ?? ''}.${
            ncPending ? ' Não conformidade incompleta.' : ''
          }`}
          accessibilityHint={
            locked ? undefined : ncPending ? 'Abre o registro da não conformidade' : 'Reabre o item para alterar a resposta'
          }
          disabled={locked}
          onPress={handleCollapsedPress}
          style={({ pressed }) => [styles.collapsed, pressed && !locked && styles.collapsedPressed]}
        >
          <View style={styles.gutter}>
            <Text style={[styles.ordinal, { color: ordinalColor }]}>
              {String(item.ordem).padStart(2, '0')}
            </Text>
          </View>
          <View style={styles.collapsedBody}>
            <Text numberOfLines={1} style={styles.collapsedTitle}>{item.titulo}</Text>
            {ncPending ? (
              <Text style={styles.collapsedPending}>
                {ncError ?? 'Toque para detalhar a não conformidade'}
              </Text>
            ) : null}
          </View>
          {locked ? (
            <Badge tone="neutral" size="sm" label="Mantido" Icon={LockKeyhole} />
          ) : ncPending ? (
            <Badge tone="warning" size="sm" label="Detalhar" Icon={AlertCircle} />
          ) : badge ? (
            <Badge tone={badge.tone} size="sm" label={badge.label} Icon={badge.Icon} />
          ) : null}
        </Pressable>
      ) : (
        <View style={styles.open}>
          <View style={styles.titleRow}>
            <View style={[styles.gutter, showPriority && styles.gutterPriority]}>
              <Text style={[styles.ordinal, { color: ordinalColor }]}>
                {String(item.ordem).padStart(2, '0')}
              </Text>
            </View>
            <Text numberOfLines={2} style={styles.title}>{item.titulo}</Text>
            {isNcItem ? (
              <Badge tone="danger" size="sm" label="NC aberta" Icon={AlertCircle} />
            ) : locked ? (
              <Badge tone="neutral" size="sm" label="Mantido" Icon={LockKeyhole} />
            ) : null}
          </View>

          {hasMethodInfo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: methodExpanded }}
              accessibilityLabel={methodExpanded ? 'Recolher método de verificação' : 'Expandir método de verificação'}
              hitSlop={8}
              onPress={() => setMethodExpanded(value => !value)}
              style={styles.methodRow}
            >
              {methodExpanded ? (
                <View style={styles.methodExpanded}>
                  {item.metodo_verif ? (
                    <View style={styles.methodBlock}>
                      <Text style={styles.overline}>MÉTODO</Text>
                      <Text style={styles.methodText}>{item.metodo_verif}</Text>
                    </View>
                  ) : null}
                  {item.tolerancia ? (
                    <View style={styles.methodBlock}>
                      <Text style={styles.overline}>TOLERÂNCIA</Text>
                      <Text style={styles.toleranceText}>{item.tolerancia}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <>
                  <Text numberOfLines={1} style={styles.methodCollapsedText}>
                    {item.metodo_verif || '—'}
                  </Text>
                  {item.tolerancia ? <Text style={styles.toleranceCollapsedText}>{item.tolerancia}</Text> : null}
                </>
              )}
              <View style={styles.methodChevron}>
                {methodExpanded
                  ? <ChevronUp size={15} color={Colors.textSecondary} />
                  : <ChevronDown size={15} color={Colors.textSecondary} />}
              </View>
            </Pressable>
          ) : null}

          <ResultToggle
            value={result}
            onChange={handleResult}
            locked={locked}
            error={itemError}
            accessibilityLabel={`Resultado do item ${item.ordem}: ${item.titulo}`}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
  rowBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  datum: { position: 'absolute', left: 0, width: 3 },
  datumPending: {
    top: Spacing.md,
    bottom: Spacing.md,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  datumAnswered: { top: 0, bottom: 0 },

  open: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    paddingLeft: Spacing.lg + 3,
    gap: 10,
  },
  collapsed: {
    minHeight: ComponentSize.choice,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingLeft: Spacing.lg + 3,
  },
  collapsedPressed: { backgroundColor: Colors.surface2 },
  collapsedBody: { flex: 1, minWidth: 0, gap: 1 },
  collapsedTitle: { ...Typography.body, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  collapsedPending: { ...Typography.caption, color: Colors.warn, fontFamily: FontFamily.semibold },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  gutter: {
    width: GUTTER,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  gutterPriority: { backgroundColor: Colors.actionSoft },
  ordinal: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },
  title: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.text,
    fontFamily: FontFamily.semibold,
    marginTop: 1,
  },
  methodRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: GUTTER + Spacing.sm,
  },
  methodCollapsedText: { flex: 1, ...Typography.caption, color: Colors.textSecondary },
  toleranceCollapsedText: { fontFamily: FontFamily.monoSemibold, fontSize: FontSizes.tiny, color: Colors.info },
  methodChevron: { width: 24, alignItems: 'flex-end' },
  methodExpanded: { flex: 1, flexDirection: 'row', gap: Spacing.lg },
  methodBlock: { flex: 1 },
  overline: { ...Typography.overline, color: Colors.textTertiary, marginBottom: 3 },
  methodText: { ...Typography.caption, color: Colors.textSecondary },
  toleranceText: { ...Typography.caption, fontFamily: FontFamily.semibold, color: Colors.info },
});
