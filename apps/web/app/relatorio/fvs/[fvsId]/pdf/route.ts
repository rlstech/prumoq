import { createClient } from '@/lib/supabase/server';
import { loadFvsReport } from '@/lib/reports/fvs';
import { renderFvsReportsHtml } from '@/lib/reports/fvs-html';
import { createPdf } from '@/lib/reports/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { fvsId: string } },
) {
  const totalStartedAt = performance.now();
  try {
    const includeAttachments =
      new URL(request.url).searchParams.get('attachments') !== '0';
    const report = await loadFvsReport(await createClient(), params.fvsId);
    if (!report) {
      return Response.json({ error: 'FVS não encontrada.' }, { status: 404 });
    }

    const dataDuration = performance.now() - totalStartedAt;
    const pdfStartedAt = performance.now();
    const pdf = await createPdf(
      renderFvsReportsHtml([report], { includeAttachments }),
    );
    const pdfDuration = performance.now() - pdfStartedAt;
    console.info('Relatório individual de FVS preparado', {
      dataMs: Math.round(dataDuration),
      pdfBytes: pdf.byteLength,
      pdfMs: Math.round(pdfDuration),
      totalMs: Math.round(performance.now() - totalStartedAt),
    });
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fvs-${params.fvsId}.pdf"`,
        'Cache-Control': 'private, no-store',
        'Server-Timing': `data;dur=${dataDuration.toFixed(1)}, pdf;dur=${pdfDuration.toFixed(1)}`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF da FVS:', error);
    return Response.json(
      { error: 'Não foi possível gerar o PDF da FVS.' },
      { status: 500 },
    );
  }
}
