import {
  BadgeCheck,
  CalendarDays,
  Flag,
  LockKeyhole,
  Printer,
  RotateCcw,
  UserRound,
} from 'lucide-react-native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, DatumCard } from './ui';
import { Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../lib/constants';

interface Conclusao {
  created_at: string;
  inspetor_nome: string;
  resultado: string;
  observacao_final: string | null;
  motivo_antes_100: string | null;
}

interface Props {
  status: 'conforme' | 'concluida' | 'concluida_ressalva';
  conclusao: Conclusao | null;
  onRequestReopen: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function FVSLockedScreen({ status, conclusao, onRequestReopen }: Props) {
  const isConcluded = status === 'conforme' || status === 'concluida';
  const toneColor = isConcluded ? Colors.ok : Colors.warn;
  const toneBackground = isConcluded ? Colors.okBg : Colors.warnBg;
  const StatusIcon = isConcluded ? BadgeCheck : Flag;
  const approved = conclusao?.resultado === 'aprovado';

  return (
    <View style={styles.container}>
      <DatumCard tone={isConcluded ? 'success' : 'warning'}>
        <View style={styles.headline}>
          <View style={[styles.statusIcon, { backgroundColor: toneBackground }]}>
            <StatusIcon size={18} color={toneColor} />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {isConcluded ? 'Serviço concluído' : 'Concluído com ressalva'}
          </Text>
          {conclusao ? (
            <Badge
              label={approved ? 'Aprovado' : 'Com ressalvas'}
              tone={approved ? 'success' : 'warning'}
              size="sm"
            />
          ) : null}
        </View>

        {conclusao ? (
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <CalendarDays size={15} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{formatDate(conclusao.created_at)}</Text>
            </View>
            <View style={styles.metaItem}>
              <UserRound size={15} color={Colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {conclusao.inspetor_nome || 'Inspetor não informado'}
              </Text>
            </View>
          </View>
        ) : null}

        {conclusao?.observacao_final ? (
          <Text style={styles.detailText}>{conclusao.observacao_final}</Text>
        ) : null}
        {conclusao?.motivo_antes_100 ? (
          <Text style={styles.detailText}>Motivo: {conclusao.motivo_antes_100}</Text>
        ) : null}

        <View style={styles.lockRow}>
          <LockKeyhole size={14} color={Colors.textTertiary} />
          <Text style={styles.lockText}>Novas verificações bloqueadas até a reabertura</Text>
        </View>
      </DatumCard>

      <View style={styles.actions}>
        <Button
          label="Exportar PDF"
          Icon={Printer}
          variant="secondary"
          style={styles.action}
          onPress={() => Alert.alert('Em breve', 'A exportação de PDF será disponibilizada em uma próxima etapa.')}
        />
        <Button
          label="Reabrir"
          Icon={RotateCcw}
          variant="secondary"
          style={styles.action}
          accessibilityHint="Abre o formulário de justificativa para reabrir o serviço"
          onPress={onRequestReopen}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.base,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  metaItem: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  detailText: {
    ...Typography.caption,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  lockRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lockText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  action: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Spacing.md,
  },
});
