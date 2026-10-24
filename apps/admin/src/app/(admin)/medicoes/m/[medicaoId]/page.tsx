import Header from '@/components/layout/Header';
import { notFound } from '@/lib/compat/navigation';
import { getMeasurementDetail } from '../../actions';
import MeasurementDetailClient from './MeasurementDetailClient';

export const dynamic = 'force-dynamic';

export default async function MeasurementPage({ params }: { params: Promise<{ medicaoId: string }> }) {
  const { medicaoId } = await params;
  const result = await getMeasurementDetail(medicaoId);
  if (!result.success) notFound();
  const { detail } = result;
  const contrato = detail.contrato;

  return (
    <>
      <Header
        breadcrumbs={[
          { label: 'Contratos e medições', href: '/medicoes' },
          ...(contrato ? [{ label: contrato.numero, href: `/medicoes/contratos/${contrato.id}` }] : []),
          { label: detail.measurement.referencia },
        ]}
      />
      <main className="prumo-page">
        <div className="prumo-page-inner">
          <MeasurementDetailClient detail={detail} />
        </div>
      </main>
    </>
  );
}
