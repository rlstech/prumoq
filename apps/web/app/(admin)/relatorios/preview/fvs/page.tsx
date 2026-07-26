import { redirect } from 'next/navigation';
import PreviewClient from './PreviewClient';

export default function FvsConsolidatedPreviewPage({
  searchParams,
}: {
  searchParams: {
    obraId?: string;
    from?: string;
    to?: string;
    attachments?: string;
  };
}) {
  if (!searchParams.obraId) redirect('/relatorios');

  return (
    <PreviewClient
      obraId={searchParams.obraId}
      from={searchParams.from ?? ''}
      to={searchParams.to ?? ''}
      initialIncludeAttachments={searchParams.attachments !== '0'}
    />
  );
}
