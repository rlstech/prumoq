import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';

const purple   = '#6A1B9A';
const purpleBg = '#F3E5F5';

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

const MOTIVOS_COMUNS = [
  { icon: '📋', label: 'Reclamação de cliente / vistoria' },
  { icon: '🔍', label: 'Auditoria interna de qualidade' },
  { icon: '🛠', label: 'Serviço complementar identificado' },
  { icon: '✏️', label: 'Correção de registro incorreto' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function FVSLockedScreen({ status, conclusao, onRequestReopen }: Props) {
  const isConcluded = status === 'concluida';
  const bannerBg    = isConcluded ? Colors.okBg   : Colors.warnBg;
  const bannerBdr   = isConcluded ? Colors.ok     : Colors.warn;
  const bannerColor = isConcluded ? Colors.ok     : Colors.warn;
  const icon        = isConcluded ? '✅'           : '⚑';
  const title       = isConcluded ? 'Serviço Concluído' : 'Concluído com ressalva';

  return (
    <View style={styles.container}>
      {/* ── Banner de conclusão ── */}
      <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: bannerBdr }]}>
        <Text style={styles.bannerIcon}>{icon}</Text>
        <Text style={[styles.bannerTitle, { color: bannerColor }]}>{title}</Text>
        {conclusao && (
          <>
            <Text style={styles.bannerMeta}>
              {formatDate(conclusao.created_at)} · {conclusao.inspetor_nome}
            </Text>
            <View style={[styles.resultadoRow, { borderTopColor: `${bannerBdr}33` }]}>
              <Text style={[styles.resultadoLabel, { color: bannerColor }]}>
                Resultado:{' '}
                <Text style={styles.resultadoValue}>
                  {conclusao.resultado === 'aprovado' ? 'Aprovado ✓' : 'Com ressalvas ⚑'}
                </Text>
              </Text>
              <Text style={[styles.pctLabel, { color: bannerColor }]}>
                {conclusao.percentual_final}% executado
              </Text>
            </View>
            {conclusao.observacao_final ? (
              <Text style={[styles.obsText, { color: bannerColor }]}>
                {conclusao.observacao_final}
              </Text>
            ) : null}
            {conclusao.motivo_antes_100 ? (
              <Text style={[styles.motivoText, { color: bannerColor }]}>
                Motivo: {conclusao.motivo_antes_100}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* ── Overlay de bloqueio ── */}
      <View style={styles.lockBox}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Nova verificação bloqueada</Text>
        <Text style={styles.lockSub}>
          Este serviço está concluído.{'\n'}
          Para nova verificação, reabra com justificativa.
        </Text>
      </View>

      {/* ── Motivos comuns ── */}
      <Text style={styles.sectionLabel}>Motivos comuns para reabertura</Text>
      <View style={styles.motivosList}>
        {MOTIVOS_COMUNS.map(m => (
          <View key={m.label} style={styles.motivoItem}>
            <Text style={styles.motivoItemIcon}>{m.icon}</Text>
            <Text style={styles.motivoItemLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Botões ── */}
      <Pressable
        style={[styles.btn, { backgroundColor: purple }]}
        onPress={onRequestReopen}
      >
        <Text style={styles.btnText}>↑ Solicitar reabertura</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, styles.btnGhost]}
        onPress={() => Alert.alert('Em breve', 'Exportação de PDF será implementada em etapa futura.')}
      >
        <Text style={styles.btnGhostText}>🖨 Exportar PDF</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },

  banner: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  bannerIcon:  { fontSize: 28, marginBottom: 2 },
  bannerTitle: { fontSize: FontSizes.md, fontWeight: '700' },
  bannerMeta:  { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  resultadoRow: {
    width: '100%',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    gap: 2,
    alignItems: 'center',
  },
  resultadoLabel: { fontSize: FontSizes.xs, fontWeight: '600' },
  resultadoValue: { fontWeight: '400' },
  pctLabel:       { fontSize: FontSizes.xs },
  obsText:        { fontSize: FontSizes.xs, fontStyle: 'italic', textAlign: 'center', marginTop: 2 },
  motivoText:     { fontSize: FontSizes.xs, textAlign: 'center', marginTop: 2 },

  lockBox: {
    backgroundColor: Colors.bg,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderNormal,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  lockIcon:  { fontSize: 22, marginBottom: 2 },
  lockTitle: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
  lockSub:   { fontSize: FontSizes.xs, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },

  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  motivosList: { gap: Spacing.xs },
  motivoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  motivoItemIcon:  { fontSize: 16 },
  motivoItemLabel: { fontSize: FontSizes.sm, color: Colors.text },

  btn: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: FontSizes.sm },
  btnGhost: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.text, fontWeight: '500', fontSize: FontSizes.sm },
});
