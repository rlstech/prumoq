'use client';

import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  obraId: string;
  from: string;
  to: string;
  initialIncludeAttachments: boolean;
}

function reportUrl(
  obraId: string,
  from: string,
  to: string,
  includeAttachments: boolean,
) {
  const params = new URLSearchParams({
    obraId,
    attachments: includeAttachments ? '1' : '0',
  });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return `/admin/relatorios/export/fvs?${params.toString()}`;
}

export default function PreviewClient({
  obraId,
  from,
  to,
  initialIncludeAttachments,
}: Props) {
  const [includeAttachments, setIncludeAttachments] = useState(
    initialIncludeAttachments,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfObjectUrl, setPdfObjectUrl] = useState('');
  const requestUrl = useMemo(
    () => reportUrl(obraId, from, to, includeAttachments),
    [obraId, from, to, includeAttachments],
  );

  useEffect(() => {
    let active = true;
    let currentObjectUrl = '';
    setLoading(true);
    setError('');
    setPdfObjectUrl('');

    void (async () => {
      try {
        const response = await fetch(requestUrl);
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            body?.error || 'Não foi possível gerar o relatório.',
          );
        }
        const blob = await response.blob();
        if (!active) return;
        currentObjectUrl = URL.createObjectURL(blob);
        setPdfObjectUrl(currentObjectUrl);
      } catch (currentError) {
        if (!active) return;
        setError(
          currentError instanceof Error
            ? currentError.message
            : 'Não foi possível gerar o relatório.',
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [requestUrl]);

  function downloadPdf() {
    if (!pdfObjectUrl) return;
    const anchor = document.createElement('a');
    anchor.href = pdfObjectUrl;
    anchor.download = `relatorio-fvs-${obraId}.pdf`;
    anchor.click();
  }

  function closePreview() {
    if (window.opener) {
      window.close();
    } else {
      window.history.back();
    }
  }

  return (
    <div className="-m-6 flex min-h-[calc(100vh-64px)] flex-col bg-bg-2">
      <div className="flex flex-wrap items-center gap-3 border-b border-brd-0 bg-bg-0 px-5 py-3 shadow-sm">
        <button
          type="button"
          onClick={closePreview}
          className="inline-flex items-center gap-2 rounded border border-brd-1 bg-bg-0 px-4 py-2 text-sm font-semibold text-txt"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <label className="flex items-center gap-2 text-sm font-medium text-txt">
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(event) => setIncludeAttachments(event.target.checked)}
            className="h-4 w-4 accent-[var(--prumo-brand)]"
          />
          Incluir anexos fotográficos
        </label>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={loading || !pdfObjectUrl}
          className="ml-auto inline-flex items-center gap-2 rounded bg-[var(--prumo-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {loading ? 'Gerando PDF...' : 'Baixar PDF'}
        </button>
        {error && (
          <p className="w-full text-right text-xs text-[var(--nok)]">{error}</p>
        )}
      </div>

      {pdfObjectUrl ? (
        <iframe
          key={pdfObjectUrl}
          src={pdfObjectUrl}
          title="Pré-visualização do relatório consolidado de FVS"
          className="min-h-[760px] flex-1 border-0 bg-bg-2"
        />
      ) : (
        <div className="flex min-h-[760px] flex-1 items-center justify-center bg-bg-2">
          {loading ? (
            <div className="flex items-center gap-3 text-sm font-medium text-txt-2">
              <Loader2 size={20} className="animate-spin" />
              Preparando pré-visualização...
            </div>
          ) : (
            <p className="text-sm font-medium text-[var(--nok)]">
              {error || 'Não foi possível visualizar o relatório.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
