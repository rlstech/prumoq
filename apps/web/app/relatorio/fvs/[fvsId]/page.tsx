import { notFound } from 'next/navigation';
import { loadFvsReport } from '@/lib/reports/fvs';
import { createClient } from '@/lib/supabase/server';
import PrintClient from './PrintClient';

export default async function FvsRelatorioPage({
  params,
  searchParams,
}: {
  params: { fvsId: string };
  searchParams: { attachments?: string };
}) {
  const report = await loadFvsReport(await createClient(), params.fvsId);
  if (!report) return notFound();

  return (
    <PrintClient
      fvsId={params.fvsId}
      header={report.header}
      verificacoes={report.verificacoes}
      ncs={report.ncs}
      conclusao={report.conclusao}
      emitidoEm={report.emitidoEm}
      initialIncludeAttachments={searchParams.attachments !== '0'}
    />
  );
}
