'use client';

import { useEffect, useState } from 'react';
import {
  FVS_REPORT_CSS,
  renderFvsReportBody,
} from '@prumoq/shared';
import type {
  FvsReportConclusion,
  FvsReportHeader,
  FvsReportNc,
  FvsReportVerification,
} from '@/lib/reports/fvs';

interface Props {
  fvsId: string;
  header: FvsReportHeader;
  verificacoes: FvsReportVerification[];
  ncs: FvsReportNc[];
  conclusao: FvsReportConclusion | null;
  emitidoEm: string;
  initialIncludeAttachments: boolean;
}

export default function PrintClient({
  fvsId,
  header,
  verificacoes,
  ncs,
  conclusao,
  emitidoEm,
  initialIncludeAttachments,
}: Props) {
  const [includeAttachments, setIncludeAttachments] = useState(
    initialIncludeAttachments,
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const html = renderFvsReportBody({
    header,
    verificacoes,
    ncs,
    conclusao,
    emitidoEm,
  }, { includeAttachments });
  const attachmentCount = verificacoes.reduce(
    (total, verification) => total + verification.fotos.length,
    0,
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('attachments', includeAttachments ? '1' : '0');
    window.history.replaceState(null, '', url);
  }, [includeAttachments]);

  async function downloadPdf() {
    setDownloading(true);
    setDownloadError('');
    try {
      const response = await fetch(
        `/admin/relatorio/fvs/${fvsId}/pdf?attachments=${includeAttachments ? '1' : '0'}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || 'Não foi possível gerar o PDF.');
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `fvs-${fvsId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : 'Não foi possível gerar o PDF.',
      );
    } finally {
      setDownloading(false);
    }
  }

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
          body { background: #F4F1E8; padding: 32px 16px 64px; }
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
          right: 16,
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
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(event) => setIncludeAttachments(event.target.checked)}
          />
          Incluir anexos ({attachmentCount})
        </label>
        <button
          onClick={downloadPdf}
          disabled={downloading}
          style={{
            background: '#163B50',
            color: 'white',
            border: 'none',
            padding: '9px 18px',
            borderRadius: 6,
            fontWeight: 600,
            cursor: downloading ? 'wait' : 'pointer',
            fontSize: 13,
            opacity: downloading ? 0.65 : 1,
          }}
        >
          {downloading ? 'Gerando PDF...' : 'Baixar PDF'}
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: '#F4F1E8',
            color: '#142522',
            border: '1px solid #C9D0CA',
            padding: '9px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Fechar
        </button>
        {downloadError && (
          <span style={{ color: '#B23A3A', fontSize: 12 }}>
            {downloadError}
          </span>
        )}
      </div>

      <div
        className="report-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
