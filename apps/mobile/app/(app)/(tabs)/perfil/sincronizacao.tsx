import { useQuery, useStatus } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../../../components/AppHeader';
import { Badge, Button, DataRow, EmptyState, ListSurface } from '../../../../components/ui';
import { Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../../../lib/constants';
import { db } from '../../../../lib/powersync';
import type { SyncFalhasRow } from '../../../../lib/schema';
import { discardQuarantined, retryQuarantined } from '../../../../lib/sync-quarantine';

/** Rótulos legíveis para os códigos que a quarentena grava. */
const CODE_LABELS: Record<string, string> = {
  '42501': 'Sem permissão no servidor',
  '23503': 'Registro relacionado não existe',
  '23502': 'Campo obrigatório vazio',
  '23505': 'Registro duplicado',
  '23514': 'Valor fora das regras do banco',
  '22P02': 'Formato de dado inválido',
  MEDIA_MISSING: 'Arquivo da foto não está mais no aparelho',
};

const OP_LABELS: Record<string, string> = {
  PUT: 'Criação',
  PATCH: 'Alteração',
  DELETE: 'Exclusão',
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Payload legível: uma linha por campo, em vez do JSON cru numa linha só. */
function formatPayload(payload: string): string {
  try {
    const data = JSON.parse(payload) as Record<string, unknown>;
    const entries = Object.entries(data);
    if (!entries.length) return '(sem campos)';
    return entries.map(([field, value]) => `${field}: ${value === null ? '—' : String(value)}`).join('\n');
  } catch {
    return payload;
  }
}

export default function SincronizacaoScreen() {
  const router = useRouter();
  const status = useStatus();
  const { data: falhas = [] } = useQuery<SyncFalhasRow>(
    'SELECT * FROM sync_falhas ORDER BY criado_em DESC',
  );
  const [fila, setFila] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshQueue = useCallback(async () => {
    try {
      const stats = await db.getUploadQueueStats();
      setFila(stats.count);
    } catch {
      setFila(null);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue, status.dataFlowStatus?.uploading, falhas.length]);

  async function handleRetry(row: SyncFalhasRow) {
    setBusyId(row.id);
    try {
      await retryQuarantined(db, row);
      await refreshQueue();
    } catch (error) {
      Alert.alert('Não foi possível reenviar', error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  }

  function handleDiscard(row: SyncFalhasRow) {
    Alert.alert(
      'Descartar registro?',
      'O registro sai da fila e não será enviado ao servidor. Não há como recuperar depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            setBusyId(row.id);
            void discardQuarantined(db, row.id).finally(() => setBusyId(null));
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title="Sincronização"
        subtitle="Fila de envio e registros recusados"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ListSurface>
          <DataRow
            label="Conexão"
            value={status.connected ? 'Conectado' : 'Offline'}
            tone={status.connected ? 'success' : 'warning'}
          />
          <DataRow
            label="Aguardando envio"
            value={fila === null ? '—' : `${fila} ${fila === 1 ? 'operação' : 'operações'}`}
            emphasis="mono"
          />
          <DataRow
            label="Recusados pelo servidor"
            value={String(falhas.length)}
            emphasis="mono"
            tone={falhas.length ? 'danger' : 'success'}
            last
          />
        </ListSurface>

        {falhas.length === 0 ? (
          <EmptyState
            Icon={status.connected ? CheckCircle2 : WifiOff}
            title={status.connected ? 'Nada travado' : 'Sem conexão'}
            description={
              status.connected
                ? 'Todos os registros criados no aparelho foram aceitos pelo servidor.'
                : 'Os registros ficam guardados no aparelho e sobem assim que houver rede.'
            }
          />
        ) : (
          <View style={styles.list}>
            <Text style={styles.overline}>REGISTROS RECUSADOS</Text>
            <Text style={styles.help}>
              Estes registros ficaram de fora para que os demais continuassem subindo. Corrija a
              causa no painel e toque em Tentar novamente, ou descarte se não forem mais
              necessários.
            </Text>

            {falhas.map(row => (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.cardTitle}>
                      {OP_LABELS[row.op] ?? row.op} · {row.tabela}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {row.registro_id}
                    </Text>
                  </View>
                  <Badge
                    label={CODE_LABELS[row.codigo] ?? row.codigo}
                    tone="danger"
                    Icon={AlertTriangle}
                    size="sm"
                  />
                </View>

                <Text style={styles.errorText}>{row.erro}</Text>
                <Text style={styles.timestamp}>Recusado em {formatDateTime(row.criado_em)}</Text>

                <View style={styles.payloadBox}>
                  <Text style={styles.payloadText}>{formatPayload(row.payload)}</Text>
                </View>

                <View style={styles.actions}>
                  <Button
                    label="Tentar novamente"
                    onPress={() => void handleRetry(row)}
                    Icon={RefreshCw}
                    variant="secondary"
                    loading={busyId === row.id}
                    accessibilityHint="Recoloca o registro na fila de envio"
                  />
                  <Button
                    label="Descartar"
                    onPress={() => handleDiscard(row)}
                    Icon={Trash2}
                    variant="ghost"
                    disabled={busyId === row.id}
                    accessibilityHint="Remove o registro do aparelho em definitivo"
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 104 },
  list: { gap: Spacing.md },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  help: { ...Typography.caption, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardTitleBlock: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  cardMeta: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: Colors.nok,
  },
  timestamp: { ...Typography.caption, color: Colors.textTertiary },
  payloadBox: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  payloadText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.xs },
});
