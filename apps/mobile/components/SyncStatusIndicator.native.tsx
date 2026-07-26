import { useStatus } from '@powersync/react-native';
import { SyncIndicator, SyncState } from './ui';

/** Compact status used by contextual headers on native builds. */
export function SyncStatusIndicator() {
  const status = useStatus();
  const uploading = status.dataFlowStatus?.uploading;
  const downloading = status.dataFlowStatus?.downloading;
  let state: SyncState = 'synced';
  if (!status.connected) state = 'offline';
  else if (uploading || downloading) state = 'syncing';
  return <SyncIndicator state={state} compact />;
}
