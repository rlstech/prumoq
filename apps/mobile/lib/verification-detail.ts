export type VerificationItemResult = 'conforme' | 'nao_conforme' | 'na';

export interface VerificationItemLike {
  resultado: string;
}

export interface OrderedVerificationItemLike {
  ordem: number;
}

export interface VerificationRecordLike {
  data_verif: string;
  numero_verif: number;
  created_at?: string | null;
}

export interface VerificationItemSummary {
  total: number;
  conformes: number;
  naoConformes: number;
  naoAplicaveis: number;
}

export interface VerificationEvidenceSummary {
  openNonConformities: number;
  resolvedNonConformities: number;
  photoCount: number;
}

export interface VerificationNonConformityLike {
  verificacao_id: string;
  status: string;
}

export interface VerificationPhotoLike {
  verificacao_id: string;
}

export function summarizeVerificationItems(items: VerificationItemLike[]): VerificationItemSummary {
  return items.reduce<VerificationItemSummary>((summary, item) => {
    summary.total += 1;
    if (item.resultado === 'conforme') summary.conformes += 1;
    else if (item.resultado === 'nao_conforme') summary.naoConformes += 1;
    else if (item.resultado === 'na') summary.naoAplicaveis += 1;
    return summary;
  }, {
    total: 0,
    conformes: 0,
    naoConformes: 0,
    naoAplicaveis: 0,
  });
}

export function sortVerificationRecords<T extends VerificationRecordLike>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const byDate = b.data_verif.localeCompare(a.data_verif);
    if (byDate !== 0) return byDate;

    const byNumber = Number(b.numero_verif) - Number(a.numero_verif);
    if (byNumber !== 0) return byNumber;

    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

export function summarizeVerificationEvidence(
  verificationId: string,
  nonConformities: VerificationNonConformityLike[],
  photos: VerificationPhotoLike[],
): VerificationEvidenceSummary {
  const verificationNonConformities = nonConformities.filter(
    nonConformity => nonConformity.verificacao_id === verificationId,
  );

  return {
    openNonConformities: verificationNonConformities.filter(
      nonConformity => nonConformity.status === 'aberta' || nonConformity.status === 'em_correcao',
    ).length,
    resolvedNonConformities: verificationNonConformities.filter(
      nonConformity => nonConformity.status === 'resolvida',
    ).length,
    photoCount: photos.filter(photo => photo.verificacao_id === verificationId).length,
  };
}

export function sortVerificationItems<T extends OrderedVerificationItemLike>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(a.ordem) - Number(b.ordem));
}

export function groupByKey<T>(items: T[], getKey: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

export function verificationDetailPath({
  obraId,
  ambienteId,
  fvsId,
  verificacaoId,
}: {
  obraId: string;
  ambienteId: string;
  fvsId: string;
  verificacaoId: string;
}): string {
  return `/obras/${encodeURIComponent(obraId)}/ambiente/${encodeURIComponent(ambienteId)}/fvs/${encodeURIComponent(fvsId)}/verificacao/${encodeURIComponent(verificacaoId)}`;
}

export function isPendingMediaKey(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith('pending:'));
}

export function resolveStoredMediaUri(
  value: string,
  publicBaseUrl = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '',
): string {
  if (value.startsWith('pending:')) return value.slice('pending:'.length);
  if (value.startsWith('data:') || value.startsWith('blob:') || /^https?:\/\//.test(value)) {
    return value;
  }

  return `${publicBaseUrl.replace(/\/$/, '')}/${value}`;
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return 'Data não informada';

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
