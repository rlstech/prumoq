import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ModalSheet, Pill, type TrenaTone } from '../ui';
import { Colors, FontFamily, FontSizes, Radius, Spacing } from '../../lib/constants';
import type { ItemRow, Resultado } from './types';

const RESULT: Record<Resultado, { label: string; tone: TrenaTone }> = {
  conforme: { label: 'Conforme', tone: 'success' },
  nao_conforme: { label: 'Não conforme', tone: 'danger' },
  na: { label: 'N/A', tone: 'neutral' },
};

/** Lista completa da vistoria para pular de item no modo "item a item". */
export function ChecklistJumpSheet({
  visible,
  onClose,
  items,
  itemResults,
  currentId,
  lockedIds,
  errorIds,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  items: readonly ItemRow[];
  itemResults: Readonly<Record<string, Resultado>>;
  currentId: string | null;
  lockedIds: ReadonlySet<string>;
  errorIds: ReadonlySet<string>;
  onSelect: (itemId: string) => void;
}) {
  const answered = items.filter(item => !!itemResults[item.id]).length;
  return (
    <ModalSheet visible={visible} onClose={onClose} title={`Itens da vistoria · ${answered}/${items.length}`}>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {items.map(item => {
          const result = itemResults[item.id];
          const locked = lockedIds.has(item.id);
          const current = item.id === currentId;
          const hasError = errorIds.has(item.id);
          const status = locked
            ? { label: 'Mantido', tone: 'neutral' as TrenaTone }
            : result
              ? RESULT[result]
              : hasError
                ? { label: 'Falta responder', tone: 'danger' as TrenaTone }
                : { label: 'Pendente', tone: 'warning' as TrenaTone };
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: current, disabled: locked }}
              accessibilityLabel={`Item ${item.ordem}: ${item.titulo}. ${status.label}.`}
              disabled={locked}
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [styles.row, current && styles.rowCurrent, pressed && styles.rowPressed, locked && styles.rowLocked]}
            >
              <View style={[styles.ordinal, current && styles.ordinalCurrent]}>
                <Text style={[styles.ordinalText, current && styles.ordinalTextCurrent]}>
                  {String(item.ordem).padStart(2, '0')}
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>{item.titulo}</Text>
              <Pill label={status.label} tone={status.tone} onSurface />
            </Pressable>
          );
        })}
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 460 },
  listContent: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  rowCurrent: { backgroundColor: Colors.brandLight },
  rowPressed: { backgroundColor: Colors.surface2 },
  rowLocked: { opacity: 0.55 },
  ordinal: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordinalCurrent: { backgroundColor: Colors.brand },
  ordinalText: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  ordinalTextCurrent: { color: Colors.surface },
  title: { flex: 1, minWidth: 0, fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, lineHeight: 19, color: Colors.text },
});
