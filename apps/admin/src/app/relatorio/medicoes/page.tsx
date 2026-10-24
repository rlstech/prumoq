import { notFound } from '@/lib/compat/navigation';
import { loadMeasurementReport } from '@/lib/reports/medicoes';
import { createClient } from '@/lib/supabase/server';
import MeasurementReportClient from './MeasurementReportClient';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function MedicoesRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string | string[]; contrato?: string | string[]; medicao?: string | string[] }>;
}) {
  const params = await searchParams;
  const filter = { obra: first(params.obra), contrato: first(params.contrato), medicao: first(params.medicao) };
  const report = await loadMeasurementReport(await createClient(), filter);
  if (!report) return notFound();
  // O navegador usa o título como nome sugerido do arquivo ao salvar em PDF.
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  document.title = filter.medicao
    ? `medicao-${report.contratos[0]?.numero ?? ''}-${report.contratos[0]?.medicoes[0]?.referencia ?? ''}`.replace(/\s+/g, '')
    : `medicoes-${filter.contrato ? report.contratos[0]?.numero ?? '' : filter.obra ? 'obra' : 'todas'}-${hoje}`;
  return <MeasurementReportClient report={report} />;
}
