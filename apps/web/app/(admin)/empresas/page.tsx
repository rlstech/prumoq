import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import EmpresasClient from './EmpresasClient';
import KPICard from '@/components/ui/KPICard';
import { Building2 } from 'lucide-react';

export default async function EmpresasPage() {
  const supabase = await createClient();

  // Using a custom select to get 'obras(count)' correctly without breaking Supabase RPCs
  const { data: empresasData } = await supabase
    .from('empresas' as never)
    .select('*, obras(count)');

  const empresas = (empresasData as any[]) || [];
  const ativas = empresas.filter(e => e.ativo).length;

  return (
    <>
      <Header breadcrumbs={[{ label: 'Empresas Parceiras' }]} />
      <div className="max-w-[1200px] mx-auto space-y-6 mt-6 px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard title="Total Cadastrado" value={empresas.length} icon={<Building2 size={20} />} />
          <KPICard title="Ativas" value={ativas} colorVariant="ok" />
          <KPICard title="Inativas" value={empresas.length - ativas} colorVariant="default" />
        </div>

        <EmpresasClient initialData={empresas} />
      </div>
    </>
  );
}
