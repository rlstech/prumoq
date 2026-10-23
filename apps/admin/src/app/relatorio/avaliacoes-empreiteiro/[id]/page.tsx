import { notFound } from '@/lib/compat/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadContractorEvaluationReport } from '@/lib/reports/contractor-evaluation';
import { renderContractorEvaluationHtml } from '@/lib/reports/contractor-evaluation-html';

// Barra de ações da página de impressão. O PDF é gerado pelo navegador ("Salvar como PDF").
const TOOLBAR_CSS =
  '<style>.pq-toolbar{position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;background:#fff;border:1px solid #D9DDD9;border-radius:8px;box-shadow:0 6px 24px rgba(20,37,34,.14);padding:8px;font:13px Arial,sans-serif}' +
  '.pq-toolbar button{border-radius:6px;padding:9px 16px;font:600 13px Arial,sans-serif;cursor:pointer}' +
  '.pq-print{background:#163B50;color:#fff;border:none}.pq-close{background:#F4F1E8;color:#142522;border:1px solid #C9D0CA}' +
  '@media screen{body{background:#F4F1E8;padding:32px 16px 64px}.sheet{background:#fff;max-width:210mm;margin:0 auto}}' +
  '@media print{.pq-toolbar{display:none!important}}</style>';
// `window.top.close()`: o documento roda num iframe (abaixo); fechar a aba é com a janela de cima.
const TOOLBAR_HTML =
  '<div class="pq-toolbar"><button type="button" class="pq-print" onclick="window.print()">Imprimir / salvar PDF</button>' +
  '<button type="button" class="pq-close" onclick="window.top.close()">Fechar</button></div>';

const escapeTitle = (value: string) => value.replace(/[<>&"]/g, '');

export default async function AvaliacaoEmpreiteiroImpressao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await loadContractorEvaluationReport(await createClient(), id);
  if (!report) return notFound();

  const title = `avaliacao-empreiteiro-${escapeTitle(id)}`;
  document.title = title;
  const html = renderContractorEvaluationHtml(report)
    .replace('</head>', `<title>${title}</title>${TOOLBAR_CSS}</head>`)
    .replace('<body>', `<body>${TOOLBAR_HTML}`);

  // Documento próprio (estilos de folha A4) isolado do CSS do painel; imprimir dentro do iframe imprime só a folha.
  return (
    <iframe
      title={title}
      srcDoc={html}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, background: '#F4F1E8' }}
    />
  );
}
