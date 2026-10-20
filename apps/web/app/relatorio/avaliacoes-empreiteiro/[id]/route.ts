import { createClient } from '@/lib/supabase/server';
import { loadContractorEvaluationReport } from '@/lib/reports/contractor-evaluation';
import { renderContractorEvaluationHtml } from '@/lib/reports/contractor-evaluation-html';

export const dynamic = 'force-dynamic';

// Barra de ações da página de impressão. O PDF é gerado pelo navegador ("Salvar como PDF").
const TOOLBAR_CSS =
  '<style>.pq-toolbar{position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;background:#fff;border:1px solid #D9DDD9;border-radius:8px;box-shadow:0 6px 24px rgba(20,37,34,.14);padding:8px;font:13px Arial,sans-serif}' +
  '.pq-toolbar button{border-radius:6px;padding:9px 16px;font:600 13px Arial,sans-serif;cursor:pointer}' +
  '.pq-print{background:#163B50;color:#fff;border:none}.pq-close{background:#F4F1E8;color:#142522;border:1px solid #C9D0CA}' +
  '@media screen{body{background:#F4F1E8;padding:32px 16px 64px}.sheet{background:#fff;max-width:210mm;margin:0 auto}}' +
  '@media print{.pq-toolbar{display:none!important}}</style>';
const TOOLBAR_HTML =
  '<div class="pq-toolbar"><button type="button" class="pq-print" onclick="window.print()">Imprimir / salvar PDF</button>' +
  '<button type="button" class="pq-close" onclick="window.close()">Fechar</button></div>';

const escapeTitle = (value: string) => value.replace(/[<>&"]/g, '');

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const report = await loadContractorEvaluationReport(await createClient(), params.id);
    if (!report) return new Response('Avaliação não encontrada.', { status: 404 });

    const title = `<title>avaliacao-empreiteiro-${escapeTitle(params.id)}</title>`;
    const html = renderContractorEvaluationHtml(report)
      .replace('</head>', `${title}${TOOLBAR_CSS}</head>`)
      .replace('<body>', `<body>${TOOLBAR_HTML}`);

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Erro ao montar a avaliação para impressão:', error);
    return new Response('Não foi possível abrir a avaliação.', { status: 500 });
  }
}
