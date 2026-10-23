import { notFound } from '@/lib/compat/navigation';
import { loadFvsReport } from '@/lib/reports/fvs';
import { createClient } from '@/lib/supabase/server';
import PrintClient from './PrintClient';

export default async function FvsRelatorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ fvsId: string }>;
  searchParams: Promise<{ attachments?: string }>;
}) {
  const [{ fvsId }, { attachments }] = await Promise.all([params, searchParams]);
  // O navegador usa o título como nome sugerido do arquivo ao salvar em PDF.
  document.title = `fvs-${fvsId}`;
  const report = await loadFvsReport(await createClient(), fvsId);
  if (!report) return notFound();

  return (
    <PrintClient
      header={report.header}
      verificacoes={report.verificacoes}
      ncs={report.ncs}
      conclusao={report.conclusao}
      emitidoEm={report.emitidoEm}
      initialIncludeAttachments={attachments !== '0'}
    />
  );
}
