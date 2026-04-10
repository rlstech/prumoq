import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import FvsPadraoClient from './FvsPadraoClient';
import KPICard from '@/components/ui/KPICard';
import { ClipboardList } from 'lucide-react';

export default async function FvsPadraoPage() {
  const supabase = await createClient();

  const { data: fvsList } = await supabase
    .from('fvs_padrao')
    .select('*, fvs_padrao_itens(count), fvs_planejadas(count)')
    .order('nome');

  const typedFvs = (fvsList as any[]) || [];

  const contagens = {
    total: typedFvs.length,
    ativas: typedFvs.filter(f => f.ativo).length,
    inativas: typedFvs.filter(f => !f.ativo).length,
    revisoes: typedFvs.reduce((acc, curr) => acc + (curr.revisao_atual || 1), 0)
  };

  return (
    <>
      <Header breadcrumbs={[{ label: 'FVS Padrão (Biblioteca)' }]} />
      
      <div className="max-w-[1200px] mx-auto p-6 space-y-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Total Cadastradas" value={contagens.total} icon={<ClipboardList size={20} />} />
          <KPICard title="Ativas" value={contagens.ativas} colorVariant="ok" />
          <KPICard title="Inativas" value={contagens.inativas} colorVariant="default" />
          <KPICard title="Revisões" value={contagens.revisoes} colorVariant="brand" />
        </div>

        <FvsPadraoClient initialData={typedFvs} />
      </div>
    </>
  );
}
