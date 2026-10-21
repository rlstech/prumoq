
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
  header: FvsReportHeader;
  verificacoes: FvsReportVerification[];
  ncs: FvsReportNc[];
  conclusao: FvsReportConclusion | null;
  emitidoEm: string;
  initialIncludeAttachments: boolean;
}

const PRINT_CSS = `
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
      `;

export default function PrintClient({
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
  const [preparing, setPreparing] = useState(false);
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

  // O PDF é gerado pelo próprio navegador ("Salvar como PDF" no diálogo de impressão).
  // Espera as fotos carregarem para não imprimir anexos em branco.
  async function printReport() {
    setPreparing(true);
    try {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('.report-preview img'));
      await Promise.all(
        images.map(img => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
      );
    } finally {
      setPreparing(false);
    }
    window.print();
  }

  return (
    <>
      {/* dangerouslySetInnerHTML: como filho de texto, as aspas do CSS saem escapadas no HTML do servidor e quebram a hidratação. */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

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
          onClick={printReport}
          disabled={preparing}
          style={{
            background: '#163B50',
            color: 'white',
            border: 'none',
            padding: '9px 18px',
            borderRadius: 6,
            fontWeight: 600,
            cursor: preparing ? 'wait' : 'pointer',
            fontSize: 13,
            opacity: preparing ? 0.65 : 1,
          }}
        >
          {preparing ? 'Carregando fotos...' : 'Imprimir / salvar PDF'}
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
      </div>

      <div
        className="report-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
