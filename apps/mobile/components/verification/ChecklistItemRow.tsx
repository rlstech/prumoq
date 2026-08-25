import { AlertCircle, ChevronDown, ChevronUp, LockKeyhole } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, ResultToggle } from '../ui';
import { Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../lib/constants';
import { EquipeRow, ItemRow, ManagerRow, NcDetail, NcFieldErrors, Resultado } from './types';
import { NcInlineForm } from './NcInlineForm';

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
  nc?: NcDetail;
  onNcChange: (patch: Partial<NcDetail>) => void;
  onNcPhoto: () => void;
  ncErrors: NcFieldErrors;
  equipes: EquipeRow[];
  managers: ManagerRow[];
  financialRequired: boolean;
}

const emptyNc: NcDetail = {
  descricao: '',
  solucao_proposta: '',
  data_nova_verif: '',
  responsavel_id: '',
  foto: null,
  financeiro: null,
};

/** Width of the ordinal gutter. Title, method line and the result control all
 * hang off the same vertical axis — the "linha de controle" that gives the
 * design system its name. */
const GUTTER = 26;

/** One dense checklist row: ordinal + title, a collapsible method/tolerance
 * line, and the always-visible tri-state result toggle. Opens an inline NC
 * form in place when the user marks the item não conforme. */
export function ChecklistItemRow({
  item,
  result,
  onResultChange,
  locked,
  isNcItem,
  isPriority = false,
  itemError,
  last = false,
  nc,
  onNcChange,
  onNcPhoto,
  ncErrors,
  equipes,
  managers,
  financialRequired,
}: Props) {
  const [methodExpanded, setMethodExpanded] = useState(false);
  const isNok = result === 'nao_conforme';
  const hasMethodInfo = !!(item.metodo_verif || item.tolerancia);

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
  // An open NC or an answered item already carries a semantic colour, and
  // design-system.md gives that priority over the Cal Viva focus marker.
  const showPriority = isPriority && !answered;
  const datumColor = semanticColor ?? (showPriority ? Colors.brandSignature : Colors.border);
  const ordinalColor = semanticColor ?? (showPriority ? Colors.brand : Colors.textTertiary);

  return (
    <View style={[styles.row, !last && styles.rowBordered]}>
      <View
        style={[
          styles.datum,
          answered ? styles.datumAnswered : styles.datumPending,
          { backgroundColor: datumColor },
        ]}
      />

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

      <View style={styles.indent}>
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
          onChange={onResultChange}
          locked={locked}
          error={itemError}
          accessibilityLabel={`Resultado do item ${item.ordem}: ${item.titulo}`}
        />

        {isNok && !isNcItem ? (
          <NcInlineForm
            detail={nc ?? emptyNc}
            onChange={onNcChange}
            onAddPhoto={onNcPhoto}
            equipes={equipes}
            errors={ncErrors}
            financialRequired={financialRequired}
            managers={managers}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingLeft: Spacing.lg + 3,
    gap: Spacing.sm,
  },
  rowBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  datum: { position: 'absolute', left: 0, width: 3 },
  datumPending: {
    top: Spacing.md,
    bottom: Spacing.md,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  datumAnswered: { top: 0, bottom: 0 },
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
  indent: { paddingLeft: GUTTER + Spacing.sm, gap: Spacing.sm },
  methodRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
