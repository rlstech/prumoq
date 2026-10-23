import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../ProgressBar';
import { Pill, ResultToggle } from '../ui';
import { Colors, FontFamily, FontSizes, Palette, Radius, Spacing } from '../../lib/constants';
import { Camera, CheckCircle2, ChevronRight, ListChecks, LockKeyhole, RotateCcw } from '../../lib/icons';
import type { ItemRow, Resultado } from './types';

/**
 * Modo "item a item" da verificação: um item por vez, com a resposta em três
 * ladrilhos grandes (Trena Suave). A lista completa continua a um toque em
 * "Ver todos os itens".
 */
export function ChecklistFocus({
  item,
  position,
  total,
  answeredCount,
  itemCount,
  result,
  onResultChange,
  locked,
  isNcItem,
  ncComplete,
  onOpenNc,
  itemError,
  ncError,
  onShowAll,
}: {
  item: ItemRow;
  /** Posição (base 1) entre os itens que podem ser respondidos. */
  position: number;
  total: number;
  answeredCount: number;
  itemCount: number;
  result?: Resultado;
  onResultChange: (value: Resultado) => void;
  locked: boolean;
  /** Item com NC aberta (reinspeção). */
  isNcItem: boolean;
  ncComplete: boolean;
  onOpenNc: () => void;
  itemError?: string;
  ncError?: string;
  onShowAll: () => void;
}) {
  const ncRequired = result === 'nao_conforme' && !isNcItem;
  const progress = itemCount > 0 ? (answeredCount / itemCount) * 100 : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <ProgressBar value={progress} height={12} color={Palette.accent} trackColor={Colors.surface2} />
        </View>
        <View
          style={styles.counter}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Item ${position} de ${total}. ${answeredCount} de ${itemCount} respondidos.`}
        >
          <Text style={styles.counterText}>{position} / {total}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.ordinal} accessibilityElementsHidden importantForAccessibility="no">
            {String(item.ordem).padStart(2, '0')}
          </Text>
          {isNcItem ? <Pill label="Reinspeção da NC" tone="danger" Icon={RotateCcw} onSurface /> : null}
          {locked ? <Pill label="Mantido" tone="neutral" Icon={LockKeyhole} onSurface /> : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">{item.titulo}</Text>

        {item.metodo_verif ? (
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Método</Text>
            <Text style={styles.infoText}>{item.metodo_verif}</Text>
          </View>
        ) : null}
        {item.tolerancia ? (
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Tolerância</Text>
            <Text style={[styles.infoText, styles.infoMono]}>{item.tolerancia}</Text>
          </View>
        ) : null}

        {ncRequired ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ncComplete ? 'Revisar a não conformidade' : 'Completar a não conformidade'}
            onPress={onOpenNc}
            style={({ pressed }) => [styles.nc, ncComplete && styles.ncDone, pressed && styles.pressed]}
          >
            {ncComplete
              ? <CheckCircle2 size={22} color={Colors.ok} />
              : <Camera size={22} color={Colors.nok} />}
            <View style={styles.ncBody}>
              <Text style={[styles.ncTitle, ncComplete && { color: Colors.ok }]}>
                {ncComplete ? 'Registro da NC completo' : 'Completar não conformidade'}
              </Text>
              <Text style={[styles.ncText, ncComplete && { color: Colors.ok }]}>
                {ncComplete
                  ? 'Toque para revisar foto, descrição, solução, prazo e responsável.'
                  : (ncError ?? 'Pede foto, descrição, solução, prazo e responsável.')}
              </Text>
            </View>
            <ChevronRight size={18} color={ncComplete ? Colors.ok : Colors.nok} />
          </Pressable>
        ) : null}

        {itemError ? <Text style={styles.error}>{itemError}</Text> : null}
      </View>

      <ResultToggle
        size="large"
        value={result}
        onChange={onResultChange}
        locked={locked}
        accessibilityLabel={`Resultado do item ${item.ordem}: ${item.titulo}`}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver todos os itens da vistoria"
        onPress={onShowAll}
        hitSlop={6}
        style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
      >
        <ListChecks size={18} color={Colors.text} />
        <Text style={styles.showAllText}>Ver todos os itens</Text>
        <Text style={styles.showAllCount}>{answeredCount}/{itemCount}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  progressBar: { flex: 1 },
  counter: {
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  counterText: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.xs, color: Colors.text },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
    minHeight: 260,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  ordinal: {
    fontFamily: FontFamily.monoBold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: Colors.surface2,
    marginRight: 'auto',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: Colors.text,
  },
  infoBlock: { gap: 2 },
  infoLabel: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Colors.textTertiary },
  infoText: { fontFamily: FontFamily.regular, fontSize: FontSizes.sm, lineHeight: 21, color: Colors.textSecondary },
  infoMono: { fontFamily: FontFamily.monoSemibold, color: Colors.info },
  nc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.nokBg,
  },
  ncDone: { backgroundColor: Colors.okBg },
  ncBody: { flex: 1, minWidth: 0, gap: 2 },
  ncTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.sm, color: Colors.nok },
  ncText: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, lineHeight: 18, color: Colors.nok },
  error: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Colors.nok },
  showAll: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  showAllText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, color: Colors.text },
  showAllCount: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  pressed: { opacity: 0.75 },
});
