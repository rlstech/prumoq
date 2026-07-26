import {
  BadgeCheck,
  ClipboardCheck,
  FilePenLine,
  Flag,
  LockKeyhole,
  Printer,
  RotateCcw,
  Search,
  Wrench,
} from 'lucide-react-native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './ui';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../lib/constants';

interface Conclusao {
  created_at: string;
  inspetor_nome: string;
  percentual_final: number;
  resultado: string;
  observacao_final: string | null;
  motivo_antes_100: string | null;
}

interface Props {
  status: 'concluida' | 'concluida_ressalva';
  conclusao: Conclusao | null;
  onRequestReopen: () => void;
}

const REOPEN_REASONS = [
  { Icon: ClipboardCheck, label: 'Reclamação de cliente ou vistoria' },
  { Icon: Search, label: 'Auditoria interna de qualidade' },
  { Icon: Wrench, label: 'Serviço complementar identificado' },
  { Icon: FilePenLine, label: 'Correção de registro incorreto' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function FVSLockedScreen({ status, conclusao, onRequestReopen }: Props) {
  const isConcluded = status === 'concluida';
  const toneColor = isConcluded ? Colors.ok : Colors.warn;
  const toneBackground = isConcluded ? Colors.okBg : Colors.warnBg;
  const StatusIcon = isConcluded ? BadgeCheck : Flag;

  return (
    <View style={styles.container}>
      <Card style={[styles.banner, { backgroundColor: toneBackground, borderColor: toneColor }]}>
        <View style={styles.statusIcon}>
          <StatusIcon size={27} color={toneColor} />
        </View>
        <Text style={[styles.bannerTitle, { color: toneColor }]}>
          {isConcluded ? 'Serviço concluído' : 'Concluído com ressalva'}
        </Text>
        {conclusao ? (
          <>
            <Text style={styles.bannerMeta}>
              {formatDate(conclusao.created_at)} · {conclusao.inspetor_nome}
            </Text>
            <View style={[styles.resultRow, { borderTopColor: `${toneColor}33` }]}>
              <Text style={[styles.resultText, { color: toneColor }]}>
                {conclusao.resultado === 'aprovado' ? 'Aprovado' : 'Com ressalvas'}
              </Text>
              <Text style={[styles.resultText, { color: toneColor }]}>
                {conclusao.percentual_final}% executado
              </Text>
            </View>
            {conclusao.observacao_final ? (
              <Text style={[styles.detailText, { color: toneColor }]}>{conclusao.observacao_final}</Text>
            ) : null}
            {conclusao.motivo_antes_100 ? (
              <Text style={[styles.detailText, { color: toneColor }]}>
                Motivo: {conclusao.motivo_antes_100}
              </Text>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card tone="soft" style={styles.lockBox}>
        <View style={styles.lockIcon}>
          <LockKeyhole size={24} color={Colors.brand} />
        </View>
        <Text style={styles.lockTitle}>Nova verificação bloqueada</Text>
        <Text style={styles.lockDescription}>
          Para registrar outra verificação, reabra o serviço com uma justificativa.
        </Text>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MOTIVOS COMUNS PARA REABERTURA</Text>
        <Card style={styles.reasonList}>
          {REOPEN_REASONS.map(({ Icon, label }, index) => (
            <View
              key={label}
              style={[styles.reasonRow, index < REOPEN_REASONS.length - 1 && styles.reasonBorder]}
            >
              <View style={styles.reasonIcon}><Icon size={17} color={Colors.textSecondary} /></View>
              <Text style={styles.reasonLabel}>{label}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.actions}>
        <Button label="Solicitar reabertura" Icon={RotateCcw} onPress={onRequestReopen} fullWidth />
        <Button
          label="Exportar PDF"
          Icon={Printer}
          variant="secondary"
          onPress={() => Alert.alert('Em breve', 'A exportação de PDF será disponibilizada em uma próxima etapa.')}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  banner: { alignItems: 'center', gap: 5 },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  bannerTitle: { ...Typography.heading, fontFamily: FontFamily.bold },
  bannerMeta: { ...Typography.caption, color: Colors.textSecondary },
  resultRow: {
    width: '100%',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  resultText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  detailText: { ...Typography.caption, textAlign: 'center' },
  lockBox: { alignItems: 'center', gap: Spacing.sm },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  lockDescription: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', maxWidth: 440 },
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.7,
  },
  reasonList: { padding: 0, overflow: 'hidden' },
  reasonRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  reasonBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  reasonIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonLabel: { ...Typography.caption, color: Colors.text },
  actions: { gap: Spacing.sm },
});
