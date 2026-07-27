import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSizes, Radius, Spacing } from '../lib/constants';

export type BadgeStatus =
  | 'conforme'
  | 'nao_conforme'
  | 'na'
  | 'em_andamento'
  | 'pendente'
  | 'aberta'
  | 'resolvida'
  | 'cancelada'
  | 'nao_iniciada'
  | 'paralisada'
  | 'concluida'
  | 'concluida_ressalva'
  | 'em_revisao';

interface StatusConfig {
  bg: string;
  text: string;
  label: string;
}

const STATUS_CONFIG: Record<BadgeStatus, StatusConfig> = {
  conforme: { bg: Colors.okBg, text: Colors.ok, label: 'Conforme' },
  nao_conforme: { bg: Colors.nokBg, text: Colors.nok, label: 'N' + String.fromCharCode(0xe3) + 'o conforme' },
  na: { bg: Colors.naBg, text: Colors.na, label: 'N/A' },
  em_andamento: { bg: Colors.progressBg, text: Colors.progress, label: 'Em andamento' },
  pendente: { bg: Colors.naBg, text: Colors.na, label: 'Pendente' },
  aberta: { bg: Colors.nokBg, text: Colors.nok, label: 'Aberta' },
  resolvida: { bg: Colors.okBg, text: Colors.ok, label: 'Resolvida' },
  cancelada: { bg: Colors.naBg, text: Colors.na, label: 'Cancelada' },
  nao_iniciada: { bg: Colors.naBg, text: Colors.na, label: 'N' + String.fromCharCode(0xe3) + 'o iniciada' },
  paralisada: { bg: Colors.warnBg, text: Colors.warn, label: 'Paralisada' },
  concluida: { bg: Colors.okBg, text: Colors.ok, label: 'Conclu' + String.fromCharCode(0xed) + 'da' },
  concluida_ressalva: { bg: Colors.warnBg, text: Colors.warn, label: 'C/ ressalva' },
  em_revisao: { bg: Colors.infoBg, text: Colors.info, label: 'Em revis' + String.fromCharCode(0xe3) + 'o' },
};

export function getStatusColor(status: BadgeStatus): string {
  return STATUS_CONFIG[status]?.text ?? Colors.na;
}

export function getStatusBg(status: BadgeStatus): string {
  return STATUS_CONFIG[status]?.bg ?? Colors.naBg;
}

interface Props {
  status: BadgeStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendente;
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text style={[styles.label, { color: config.text }, isSmall && styles.labelSm]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.1,
  },
  labelSm: {
    fontSize: FontSizes.tiny,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
});
