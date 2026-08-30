import { SyncIndicator, SyncIndicatorTone } from './ui';

interface Props {
  /** `onBrand` na capa do dashboard; `surface` nos cabecalhos claros. */
  tone?: SyncIndicatorTone;
  compact?: boolean;
}

/** TypeScript fallback; Expo resolves the native/web variants at runtime. */
export function SyncStatusIndicator({ tone = 'surface', compact = true }: Props = {}) {
  return <SyncIndicator state="synced" compact={compact} tone={tone} />;
}
