import { AlertCircle, ArrowRight, CheckCircle2, Circle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, DatumCard, Progress } from '../ui';
import { Colors, FontFamily, Spacing, Typography } from '../../lib/constants';
import type { ItemRow, NcAbertaRow, Resultado } from './types';

interface Props {
  items: readonly ItemRow[];
  itemResults: Readonly<Record<string, Resultado>>;
  openNcs: readonly NcAbertaRow[];
  onOpenPriority: () => void;
}

/**
 * Turns a verification checklist into a compact field route. When an NC is
 * open, reinspection is always surfaced as the next action; otherwise the
 * first unanswered item is the next stop. It is presentation-only: the
 * existing draft state machine, validation and offline writes remain intact.
 */
export function FieldRoute({ items, itemResults, openNcs, onOpenPriority }: Props) {
  if (items.length === 0) return null;

  const priorityNc = openNcs[0];
  const priorityItem = priorityNc
    ? items.find(item => item.id === priorityNc.fvs_padrao_item_id)
    : items.find(item => !itemResults[item.id]);
  const completed = items.filter(item => !!itemResults[item.id]).length;
  const isReinspection = !!priorityNc;
  const tone = isReinspection ? 'danger' : completed === items.length ? 'success' : 'accent';
  const title = isReinspection
    ? `Reinspecionar ${priorityItem?.titulo ?? 'não conformidade'}`
    : priorityItem
      ? `Próximo: ${priorityItem.titulo}`
      : 'Checklist classificado';
  const detail = isReinspection
    ? `NC #${priorityNc.numero_ocorrencia} · ${priorityNc.data_nova_verif ? `prazo ${formatDate(priorityNc.data_nova_verif)}` : 'prazo pendente'}`
    : completed === items.length
      ? 'Revise os itens ou avance para o fechamento.'
      : `${items.length - completed} ${items.length - completed === 1 ? 'item pendente' : 'itens pendentes'}`;

  return (
    <DatumCard
      tone={tone}
      onPress={onOpenPriority}
      accessibilityLabel={`${title}. ${detail}. Abrir próxima ação.`}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.overline}>FILA DE CAMPO</Text>
        {isReinspection ? <Badge tone="danger" size="sm" label="NC aberta" Icon={AlertCircle} /> : null}
      </View>

      <Text numberOfLines={2} style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>

      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: items.length, now: completed }} style={styles.route}>
        {items.map(item => {
          const isPriority = item.id === priorityNc?.fvs_padrao_item_id || (!isReinspection && item.id === priorityItem?.id);
          const result = itemResults[item.id];
          const color = isPriority
            ? (isReinspection ? Colors.nok : Colors.brand)
            : result === 'conforme'
              ? Colors.ok
              : result === 'na'
                ? Colors.na
                : Colors.borderNormal;
          return <View key={item.id} style={[styles.routePoint, { backgroundColor: color }]} />;
        })}
      </View>

      <View style={styles.actionRow}>
        <View style={styles.actionCopy}>
          {isReinspection ? <AlertCircle size={16} color={Colors.nok} /> : completed === items.length ? <CheckCircle2 size={16} color={Colors.ok} /> : <Circle size={16} color={Colors.brand} />}
          <Text style={[styles.actionText, isReinspection && styles.actionTextDanger]}>
            {isReinspection ? 'Comprovar correção' : completed === items.length ? 'Revisar checklist' : 'Abrir próximo item'}
          </Text>
        </View>
        <ArrowRight size={18} color={Colors.brand} />
      </View>
      <Progress value={(completed / items.length) * 100} height={4} tone={isReinspection ? 'danger' : completed === items.length ? 'success' : 'brand'} />
    </DatumCard>
  );
}

function formatDate(value: string): string {
  const [, month, day] = value.split('-');
  return day && month ? `${day}/${month}` : value;
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  title: { ...Typography.heading, color: Colors.text },
  detail: { ...Typography.caption, color: Colors.textSecondary },
  route: { flexDirection: 'row', gap: 5, paddingVertical: Spacing.xs },
  routePoint: { flex: 1, height: 6, minWidth: 6, borderRadius: 3 },
  actionRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  actionCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  actionText: { ...Typography.label, color: Colors.brand, fontFamily: FontFamily.semibold },
  actionTextDanger: { color: Colors.nok },
});
