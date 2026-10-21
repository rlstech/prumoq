import { useQuery, useStatus } from '@powersync/react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useConexaoEstavel } from '../hooks/useConexaoEstavel';
import { SyncIndicator, SyncIndicatorTone, SyncState } from './ui';

interface Props {
  /** `onBrand` na capa do dashboard; `surface` nos cabecalhos claros. */
  tone?: SyncIndicatorTone;
  compact?: boolean;
}

interface PendingRow { pendentes: number }

/**
 * Estado real da sincronização.
 *
 * Antes este indicador só olhava `connected` e `uploading/downloading`, então
 * entre uma tentativa e outra de um envio que o servidor recusava ele exibia
 * "sincronizado" — o app passou um dia inteiro sem gravar nada dizendo que
 * estava em dia. Agora `uploadError` e a quarentena mandam no estado, e tocar
 * no indicador abre a tela que explica o que travou.
 */
export function SyncStatusIndicator({ tone = 'surface', compact = true }: Props = {}) {
  const router = useRouter();
  const status = useStatus();
  const conexao = useConexaoEstavel();
  const { data: falhas = [] } = useQuery<PendingRow>(
    'SELECT COUNT(*) AS pendentes FROM sync_falhas',
  );
  const quarantined = falhas[0]?.pendentes ?? 0;

  const uploading = status.dataFlowStatus?.uploading;
  const downloading = status.dataFlowStatus?.downloading;
  const failing = !!status.dataFlowStatus?.uploadError || !!status.dataFlowStatus?.downloadError;

  let state: SyncState = 'synced';
  let label: string | undefined;

  if (quarantined > 0) {
    state = 'error';
    label = quarantined === 1 ? '1 envio recusado' : `${quarantined} envios recusados`;
  } else if (conexao === 'offline') {
    state = 'offline';
  } else if (conexao === 'conectando') {
    // Abrindo o app ou entre tentativas de reconexão, com rede: não é "offline".
    state = 'syncing';
    label = 'Conectando…';
  } else if (failing) {
    state = 'error';
    label = 'Falha ao enviar';
  } else if (uploading || downloading) {
    state = 'syncing';
  }

  const indicator = <SyncIndicator state={state} label={label} compact={compact} tone={tone} />;
  if (state !== 'error') return indicator;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Falha na sincronização. Abrir detalhes.'}
      onPress={() => router.push('/(app)/(tabs)/perfil/sincronizacao' as never)}
      hitSlop={8}
    >
      {indicator}
    </Pressable>
  );
}
