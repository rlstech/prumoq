import {
  FVS_REPORT_CSS,
  fvsPhotoPlaceholderDataUrl,
  renderFvsReportBody,
  resolveFvsReportPhotoSource,
} from '@prumoq/shared';
import type {
  FvsPrintableConclusion,
  FvsPrintableHeader,
  FvsPrintableItem,
  FvsPrintableNc,
  FvsPrintablePhoto,
  FvsPrintableReport,
  FvsPrintableVerification,
} from '@prumoq/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

type RawVerification = Omit<FvsPrintableVerification, 'items' | 'fotos'>;
type ItemRow = FvsPrintableItem & { verificacao_id: string };
type PhotoRow = {
  id: string;
  verificacao_id: string;
  r2_key: string;
  ordem: number | null;
  kind: string;
  label: string | null;
};

const REPORT_PAGE_SIZE = 1000;
const VERIFICATION_ID_BATCH_SIZE = 100;
const IMAGE_READY_TIMEOUT_MS = 3_000;

function resolveR2(key: string | null | undefined, signed: Record<string, string>): string | null {
  if (!key) return null;
  if (key.startsWith('http') || key.startsWith('data:')) return key;
  if (key.startsWith('blob:') || key.startsWith('pending:')) return null;
  return signed[key] ?? null;
}

async function waitForPrintableImage(
  image: HTMLImageElement,
  timeoutMs: number,
): Promise<void> {
  if (image.complete && image.naturalWidth > 0) return;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const loaded = await Promise.race([
    image
      .decode()
      .then(() => true)
      .catch(() => image.complete && image.naturalWidth > 0),
    new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  if (timeoutId) clearTimeout(timeoutId);
  if (loaded || image.dataset.pdfKind !== 'photo') return;

  image.src = fvsPhotoPlaceholderDataUrl('expired');
  await image.decode().catch(() => undefined);
}

async function loadAllPages<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += REPORT_PAGE_SIZE) {
    const response = await loadPage(from, from + REPORT_PAGE_SIZE - 1);
    if (response.error) throw response.error;
    const page = response.data ?? [];
    rows.push(...page);
    if (page.length < REPORT_PAGE_SIZE) return rows;
  }
}

async function loadReportItems(
  verificationIds: string[],
): Promise<ItemRow[]> {
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
      loadAllPages<ItemRow>((from, to) =>
        supabase
          .from('verificacao_itens')
          .select(
            'id, verificacao_id, fvs_padrao_item_id, ordem, titulo, metodo_verif, tolerancia, resultado',
          )
          .in('verificacao_id', ids)
          .order('verificacao_id')
          .order('ordem')
          .range(from, to),
      ),
    ),
  );
  return pages.flat();
}

export default function FvsPrintPage() {
  const { fvsId, attachments } = useLocalSearchParams<{
    fvsId: string;
    attachments?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<FvsPrintableReport | null>(null);
  const [includeAttachments, setIncludeAttachments] = useState(
    attachments !== '0',
  );
  const [imagesReady, setImagesReady] = useState(false);
  const reportStartedAtRef = useRef(performance.now());
  const dataReadyAtRef = useRef(0);

  useEffect(() => {
    if (!fvsId) return;

    let active = true;
    reportStartedAtRef.current = performance.now();
    (async () => {
      try {
        const verificationRowsPromise = loadAllPages<RawVerification>(
          (from, to) =>
            supabase
              .rpc('get_verificacoes_fvs', { p_fvs_id: fvsId })
              .range(from, to),
        );
        const itemRowsPromise = verificationRowsPromise.then((rows) => {
          const verificationIds = rows.map((verification) => verification.id);
          return verificationIds.length
            ? loadReportItems(verificationIds)
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
          supabase.rpc('get_fvs_header', { p_fvs_id: fvsId }),
          verificationRowsPromise,
          loadAllPages<PhotoRow>((from, to) =>
            supabase
              .rpc('get_fvs_attachments', { p_fvs_id: fvsId })
              .range(from, to),
          ),
          loadAllPages<FvsPrintableNc>((from, to) =>
            supabase
              .rpc('get_ncs_fvs', { p_fvs_id: fvsId })
              .range(from, to),
          ),
          supabase
            .from('fvs_conclusoes')
            .select(
              'numero_conclusao, percentual_final, resultado, observacao_final, assinatura_url, inspetor_id, created_at',
            )
            .eq('fvs_planejada_id', fvsId)
            .order('numero_conclusao', { ascending: false })
            .limit(1),
          itemRowsPromise,
        ]);

        const requestError = [
          headerRes.error,
          conclusaoRes.error,
        ].find(Boolean);
        if (requestError) throw requestError;

        const header = (
          headerRes.data as unknown as FvsPrintableHeader[] | null
        )?.[0];
        if (!header) throw new Error('FVS não encontrada.');

        const verifications = [...verificationRows].reverse();

        const mediaKeys = Array.from(new Set([
          ...photoRows.map(photo => photo.r2_key),
          ...verifications.map(verification => verification.assinatura_url).filter((value): value is string => Boolean(value)),
          ...((conclusaoRes.data ?? []) as Array<{ assinatura_url: string | null }>).map(row => row.assinatura_url).filter((value): value is string => Boolean(value)),
        ].filter(key => !key.startsWith('http') && !key.startsWith('data:') && !key.startsWith('pending:') && !key.startsWith('blob:'))));
        const { data: signedResult, error: signedError } = mediaKeys.length
          ? await supabase.functions.invoke('r2-presign', { body: { operation: 'download', keys: mediaKeys } })
          : { data: { urls: {} }, error: null };
        if (signedError) throw signedError;
        const signedMedia = (signedResult as { urls?: Record<string, string> } | null)?.urls ?? {};

        const photosMap = new Map<string, FvsPrintablePhoto[]>();
        for (const photo of photoRows) {
          const source = resolveFvsReportPhotoSource(resolveR2(photo.r2_key, signedMedia) ?? '', '');
          if (!source) continue;
          const photos = photosMap.get(photo.verificacao_id) ?? [];
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
          photosMap.set(photo.verificacao_id, photos);
        }

        const itemsMap = new Map<string, FvsPrintableItem[]>();
        for (const item of itemRows) {
          const items = itemsMap.get(item.verificacao_id) ?? [];
          items.push(item);
          itemsMap.set(item.verificacao_id, items);
        }

        const report: FvsPrintableReport = {
          header,
          verificacoes: verifications.map((verification) => ({
            ...verification,
            assinatura_url: resolveR2(verification.assinatura_url, signedMedia),
            items: itemsMap.get(verification.id) ?? [],
            fotos: photosMap.get(verification.id) ?? [],
          })),
          ncs: ncRows,
          conclusao: (() => {
            const conclusion = (
              conclusaoRes.data as unknown as
                | FvsPrintableConclusion[]
                | null
            )?.[0] ?? null;
            return conclusion ? {
              ...conclusion,
              assinatura_url: resolveR2(conclusion.assinatura_url, signedMedia),
            } : null;
          })(),
          emitidoEm: new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo',
          }).format(new Date()),
        };

        if (active) {
          dataReadyAtRef.current = performance.now();
          console.info('Dados do relatório FVS carregados', {
            attachments: report.verificacoes.reduce(
              (total, verification) => total + verification.fotos.length,
              0,
            ),
            dataMs: Math.round(
              dataReadyAtRef.current - reportStartedAtRef.current,
            ),
            items: itemRows.length,
            verifications: report.verificacoes.length,
          });
          setData(report);
        }
      } catch (currentError) {
        console.error('Falha ao carregar relatório FVS:', currentError);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [fvsId]);

  useEffect(() => {
    if (loading || !data) return;
    setImagesReady(false);
    const imagesStartedAt = performance.now();
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>('.report-preview img'),
    );
    void Promise.all(
      images.map((image) =>
        waitForPrintableImage(image, IMAGE_READY_TIMEOUT_MS),
      ),
    ).finally(() => {
      const readyAt = performance.now();
      console.info('Relatório FVS pronto para impressão', {
        images: images.length,
        imagesMs: Math.round(readyAt - imagesStartedAt),
        totalMs: Math.round(readyAt - reportStartedAtRef.current),
      });
      setImagesReady(true);
    });
  }, [loading, data, includeAttachments]);

  const html = useMemo(
    () =>
      data ? renderFvsReportBody(data, { includeAttachments }) : '',
    [data, includeAttachments],
  );

  if (loading) {
    return (
      <div style={feedbackStyle}>
        Preparando relatório...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...feedbackStyle, color: '#B23A3A' }}>
        FVS não encontrada ou sem permissão.
      </div>
    );
  }

  const attachmentCount = data.verificacoes.reduce(
    (total, verification) => total + verification.fotos.length,
    0,
  );

  return (
    <>
      <style>{`
        ${FVS_REPORT_CSS}
        .no-print { display: flex; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white; }
        }
        @media screen {
          html, body, #root {
            display: block !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
          }
          body {
            background: #F4F1E8;
            overflow-y: auto !important;
            padding: 88px 16px 64px;
          }
          .report-preview {
            background: white;
            max-width: 1123px;
            margin: 0 auto;
            box-shadow: 0 4px 32px rgba(20, 37, 34, 0.10);
            border-radius: 8px;
          }
          .report-preview .report { padding: 36px 42px; }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999,
          gap: 8,
          alignItems: 'center',
          background: 'white',
          border: '1px solid #D9DDD9',
          borderRadius: 8,
          boxShadow: '0 6px 24px rgba(20, 37, 34, 0.14)',
          padding: 8,
        }}
      >
        <label
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 7,
            padding: '0 8px',
            color: '#142522',
            fontFamily: 'IBM Plex Sans, Arial, sans-serif',
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(event) => {
              reportStartedAtRef.current = performance.now();
              setImagesReady(false);
              setIncludeAttachments(event.target.checked);
            }}
          />
          Incluir anexos ({attachmentCount})
        </label>
        <button
          onClick={() => window.print()}
          disabled={!imagesReady}
          style={{
            background: '#163B50',
            color: 'white',
            border: 'none',
            padding: '10px 18px',
            minHeight: 44,
            borderRadius: 6,
            fontWeight: 600,
            cursor: imagesReady ? 'pointer' : 'wait',
            fontSize: 13,
            opacity: imagesReady ? 1 : 0.6,
          }}
        >
          {imagesReady ? 'Imprimir / Salvar PDF' : 'Carregando imagens...'}
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: '#E4E7E1',
            color: '#142522',
            border: '1px solid #C9D0CA',
            padding: '10px 14px',
            minHeight: 44,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Fechar
        </button>
      </div>

      <div
        className="report-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

const feedbackStyle = {
  alignItems: 'center',
  color: '#52615B',
  display: 'flex',
  fontFamily: 'IBM Plex Sans, Arial, sans-serif',
  height: '100vh',
  justifyContent: 'center',
} as const;
