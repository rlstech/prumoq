import { createAdminClient } from '@/lib/supabase/admin';
import Header from '@/components/layout/Header';
import EmpresasClient from './EmpresasClient';
import KPICard from '@/components/ui/KPICard';
import { Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EmpresasPage() {
  const supabaseAdmin = createAdminClient();
  const { data: empresasData } = await supabaseAdmin
    .from('empresas' as any)
    .select('*, obras(count)');

  const empresas = (empresasData as any[]) || [];
  const ativas = empresas.filter(e => e.ativo).length;

  return (
    <>
      <Header breadcrumbs={[{ label: 'Empresas Parceiras' }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard title="Total Cadastrado" value={empresas.length} icon={<Building2 size={20} />} />
          <KPICard title="Ativas" value={ativas} colorVariant="ok" />
          <KPICard title="Inativas" value={empresas.length - ativas} colorVariant="default" />
        </div>

        <EmpresasClient initialData={empresas} />
        </div>
      </div>
    </>
  );
}