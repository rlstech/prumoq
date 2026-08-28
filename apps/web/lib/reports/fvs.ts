import {
  resolveFvsReportPhotoSource,
  type Database,
  type FvsPrintableConclusion,
  type FvsPrintableItem,
  type FvsPrintablePhoto,
  type FvsPrintableReport,
  type FvsPrintableVerification,
} from '@prumoq/shared';
import type { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPrivateMedia } from '@/lib/media/signed-urls';

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type VerificationRpcRow =
  Database['public']['Functions']['get_verificacoes_fvs']['Returns'][number];
type PhotoRpcRow =
  Database['public']['Functions']['get_fvs_attachments']['Returns'][number];
type NcRpcRow =
  Database['public']['Functions']['get_ncs_fvs']['Returns'][number];
type ReportItemRow = FvsReportItem & { verificacao_id: string };

const REPORT_PAGE_SIZE = 1000;
const VERIFICATION_ID_BATCH_SIZE = 100;

export type FvsReportHeader =
  Database['public']['Functions']['get_fvs_header']['Returns'][number];
export type FvsReportNc =
  Database['public']['Functions']['get_ncs_fvs']['Returns'][number];

export type FvsReportItem = FvsPrintableItem;
export type FvsReportPhoto = FvsPrintablePhoto;
export type FvsReportVerification = FvsPrintableVerification;
export type FvsReportConclusion = FvsPrintableConclusion;

export interface FvsReportData extends FvsPrintableReport {
  header: FvsReportHeader;
  verificacoes: FvsReportVerification[];
  ncs: FvsReportNc[];
  conclusao: FvsReportConclusion | null;
  emitidoEm: string;
}

function resolveR2(key: string | null | undefined, signed: Map<string, string>): string | null {
  if (!key) return null;
  // Media references are object keys, never caller-controlled URLs. Accepting a
  // URL here would let a database write turn into a server-side request during
  // PDF generation.
  if (key.startsWith('http') || key.startsWith('data:')) return null;
  if (key.startsWith('pending:') || key.startsWith('blob:')) return null;
  return signed.get(key) ?? null;
}

function assertNoError(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
}

async function loadAllPages<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  operation: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += REPORT_PAGE_SIZE) {
    const response = await loadPage(from, from + REPORT_PAGE_SIZE - 1);
    assertNoError(response.error, operation);
    const page = response.data ?? [];
    rows.push(...page);
    if (page.length < REPORT_PAGE_SIZE) return rows;
  }
}

async function loadReportItems(
  client: SupabaseClient<Database>,
  verificationIds: string[],
): Promise<ReportItemRow[]> {
  const batches: string[][] = [];
  for (
    let index = 0;
    index < verificationIds.length;
    index += VERIFICATION_ID_BATCH_SIZE
  ) {
    batches.push(
      verificationIds.slice(index, index + VERIFICATION_ID_BATCH_SIZE),
    );
  }

  const pages = await Promise.all(
    batches.map((ids) =>
      loadAllPages<ReportItemRow>(
        (from, to) =>
          client
            .from('verificacao_itens')
            .select(
              'id, verificacao_id, fvs_padrao_item_id, ordem, titulo, metodo_verif, tolerancia, resultado',
            )
            .in('verificacao_id', ids)
            .order('verificacao_id')
            .order('ordem')
            .range(from, to),
        'Falha ao carregar os itens da verificação',
      ),
    ),
  );

  return pages.flat();
}

export async function loadFvsReport(
  supabase: ServerSupabaseClient,
  fvsId: string,
): Promise<FvsReportData | null> {
  // @supabase/ssr infere o terceiro parâmetro genérico como o schema resolvido,
  // enquanto supabase-js o declara como o nome do schema. A API em runtime é a
  // mesma; esta conversão mantém as consultas tipadas pelo Database compartilhado.
  const client = supabase as unknown as SupabaseClient<Database>;
  const verificationRowsPromise = loadAllPages<VerificationRpcRow>(
    (from, to) =>
      client
        .rpc('get_verificacoes_fvs', { p_fvs_id: fvsId })
        .range(from, to),
    'Falha ao carregar as verificações',
  );
  const itemRowsPromise = verificationRowsPromise.then((rows) => {
    const verificationIds = rows.map((verification) => verification.id);
    return verificationIds.length > 0
      ? loadReportItems(client, verificationIds)
      : Promise.resolve([]);
  });
  const [
    headerRes,
    verificationRows,
    photoRows,
    ncRows,
    conclusaoRes,
    itemRows,
  ] = await Promise.all([
      client.rpc('get_fvs_header', { p_fvs_id: fvsId }),
      verificationRowsPromise,
      loadAllPages<PhotoRpcRow>(
        (from, to) =>
          client
            .rpc('get_fvs_attachments', { p_fvs_id: fvsId })
            .range(from, to),
        'Falha ao carregar os anexos fotográficos',
      ),
      loadAllPages<NcRpcRow>(
        (from, to) =>
          client.rpc('get_ncs_fvs', { p_fvs_id: fvsId }).range(from, to),
        'Falha ao carregar as não conformidades',
      ),
      client
        .from('fvs_conclusoes')
        .select(
          'numero_conclusao, percentual_final, resultado, observacao_final, assinatura_url, inspetor_id, created_at, usuarios!inspetor_id(nome)',
        )
        .eq('fvs_planejada_id', fvsId)
        .order('numero_conclusao', { ascending: false })
        .limit(1),
      itemRowsPromise,
    ]);

  assertNoError(headerRes.error, 'Falha ao carregar o cabeçalho da FVS');
  assertNoError(conclusaoRes.error, 'Falha ao carregar a conclusão');

  const header = headerRes.data?.[0];
  if (!header) return null;

  const verificacoes = [...verificationRows].reverse();
  const conclusaoRow = (conclusaoRes.data?.[0] ?? null) as unknown as
    | (Omit<FvsReportConclusion, 'inspetor_nome'> & {
        usuarios: { nome: string | null } | null;
      })
    | null;
  const conclusao = conclusaoRow
    ? {
        numero_conclusao: conclusaoRow.numero_conclusao,
        percentual_final: conclusaoRow.percentual_final,
        resultado: conclusaoRow.resultado,
        observacao_final: conclusaoRow.observacao_final,
        assinatura_url: conclusaoRow.assinatura_url,
        inspetor_id: conclusaoRow.inspetor_id,
        inspetor_nome: conclusaoRow.usuarios?.nome ?? null,
        created_at: conclusaoRow.created_at,
      }
    : null;
  const signedMedia = await signPrivateMedia(client, [
    ...photoRows.map(photo => photo.r2_key),
    ...verificacoes.map(verification => verification.assinatura_url),
    conclusao?.assinatura_url,
  ]);

  const fotosMap = new Map<string, FvsReportPhoto[]>();
  for (const photo of photoRows) {
    const signedSource = resolveR2(photo.r2_key, signedMedia);
    const source = signedSource
      ? { url: signedSource, availability: 'available' as const }
      : resolveFvsReportPhotoSource(photo.r2_key, '');
    if (!source) continue;
    const photos = fotosMap.get(photo.verificacao_id) ?? [];
    photos.push({
      id: photo.id,
      r2_url: source.url,
      ordem: photo.ordem ?? 0,
      kind:
        photo.kind === 'nc' || photo.kind === 'reinspection'
          ? photo.kind
          : 'verification',
      label: photo.label,
      availability: source.availability,
    });
    fotosMap.set(photo.verificacao_id, photos);
  }

  const itemsMap = new Map<string, FvsReportItem[]>();
  for (const item of itemRows) {
    const items = itemsMap.get(item.verificacao_id) ?? [];
    items.push(item);
    itemsMap.set(item.verificacao_id, items);
  }

  return {
    header,
    verificacoes: verificacoes.map((verification) => ({
      ...verification,
      assinatura_url: resolveR2(verification.assinatura_url, signedMedia),
      items: itemsMap.get(verification.id) ?? [],
      fotos: fotosMap.get(verification.id) ?? [],
    })),
    ncs: ncRows,
    conclusao: conclusao ? { ...conclusao, assinatura_url: resolveR2(conclusao.assinatura_url, signedMedia) } : null,
    emitidoEm: new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date()),
  };
}
