import { useStatus } from '@powersync/react-native';
import { SyncIndicator, SyncIndicatorTone, SyncState } from './ui';

interface Props {
  /** `onBrand` na capa do dashboard; `surface` nos cabecalhos claros. */
  tone?: SyncIndicatorTone;
  compact?: boolean;
}

/** Compact status used by contextual headers on native builds. */
export function SyncStatusIndicator({ tone = 'surface', compact = true }: Props = {}) {
  const status = useStatus();
  const uploading = status.dataFlowStatus?.uploading;
  const downloading = status.dataFlowStatus?.downloading;
  let state: SyncState = 'synced';
  if (!status.connected) state = 'offline';
  else if (uploading || downloading) state = 'syncing';
  return <SyncIndicator state={state} compact={compact} tone={tone} />;
}
