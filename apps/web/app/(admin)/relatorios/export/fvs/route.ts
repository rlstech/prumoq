import { createClient } from '@/lib/supabase/server';
import { loadFvsReport, type FvsReportData } from '@/lib/reports/fvs';
import { renderFvsReportsHtml } from '@/lib/reports/fvs-html';
import { createPdf } from '@/lib/reports/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const REPORT_LOAD_CONCURRENCY = 4;

function inPeriod(date: string, from: string | null, to: string | null) {
  return (!from || date >= from) && (!to || date <= to);
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => worker(),
    ),
  );
  return results;
}

export async function GET(request: Request) {
  const totalStartedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const obraId = searchParams.get('obraId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const includeAttachments = searchParams.get('attachments') !== '0';
  const disposition = searchParams.get('download') === '1'
    ? 'attachment'
    : 'inline';

  if (!obraId) {
    return Response.json({ error: 'Selecione uma obra.' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: ambientes, error: ambientesError } = await supabase
      .from('ambientes')
      .select('id')
      .eq('obra_id', obraId);

    if (ambientesError) throw ambientesError;
    const ambienteIds = ((ambientes ?? []) as Array<{ id: string }>).map(
      (ambiente) => ambiente.id,
    );
    if (!ambienteIds.length) {
      return Response.json(
        { error: 'A obra não possui ambientes com FVS.' },
        { status: 404 },
      );
    }

    const { data: fvsRows, error: fvsError } = await supabase
      .from('fvs_planejadas')
      .select('id')
      .in('ambiente_id', ambienteIds)
      .order('subservico');
    if (fvsError) throw fvsError;

    const loadedReports = await mapWithConcurrency(
      (fvsRows ?? []) as Array<{ id: string }>,
      REPORT_LOAD_CONCURRENCY,
      async (row): Promise<FvsReportData | null> => {
        const report = await loadFvsReport(supabase, row.id);
        if (!report) return null;
        report.verificacoes = report.verificacoes.filter((verification) =>
          inPeriod(verification.data_verif, from, to),
        );
        const verificationIds = new Set(
          report.verificacoes.map((verification) => verification.id),
        );
        report.ncs = report.ncs.filter((nc) =>
          verificationIds.has(nc.verificacao_id),
        );
        return report.verificacoes.length ? report : null;
      },
    );
    const reports = loadedReports.filter(
      (report): report is FvsReportData => report !== null,
    );

    if (!reports.length) {
      return Response.json(
        { error: 'Nenhuma verificação encontrada no período selecionado.' },
        { status: 404 },
      );
    }

    const dataDuration = performance.now() - totalStartedAt;
    const pdfStartedAt = performance.now();
    const pdf = await createPdf(
      renderFvsReportsHtml(reports, { includeAttachments }),
    );
    const pdfDuration = performance.now() - pdfStartedAt;
    console.info('Relatório consolidado de FVS preparado', {
      dataMs: Math.round(dataDuration),
      fvsCount: reports.length,
      pdfBytes: pdf.byteLength,
      pdfMs: Math.round(pdfDuration),
      totalMs: Math.round(performance.now() - totalStartedAt),
    });
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="relatorio-fvs-${obraId}.pdf"`,
        'Cache-Control': 'private, no-store',
        'Server-Timing': `data;dur=${dataDuration.toFixed(1)}, pdf;dur=${pdfDuration.toFixed(1)}`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar relatório consolidado de FVS:', error);
    return Response.json(
      { error: 'Não foi possível gerar o relatório de FVS.' },
      { status: 500 },
    );
  }
}
