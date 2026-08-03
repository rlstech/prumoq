import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import EmpresasClient from './EmpresasClient';
import KPICard from '@/components/ui/KPICard';
import { Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: empresasData, error: empresasError } = await supabase
    .from('empresas')
    .select('*, obras!obras_empresa_id_fkey(count)');

  const empresas = empresasData || [];
  const ativas = empresas.filter(e => e.ativo).length;

  return (
    <>
      <Header breadcrumbs={[{ label: 'Empresas Parceiras' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard title="Total Cadastrado" value={empresas.length} icon={<Building2 size={20} />} />
          <KPICard title="Ativas" value={ativas} colorVariant="ok" />
          <KPICard title="Inativas" value={empresas.length - ativas} colorVariant="default" />
        </div>

        <EmpresasClient
          initialData={empresas}
          loadError={empresasError ? 'Não foi possível carregar as empresas. Atualize a página ou tente novamente.' : undefined}
        />
        </div>
      </div>
    </>
  );
}
