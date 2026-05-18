import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import RelatorioFvsCard from './RelatorioFvsCard';

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const { data: obras } = await supabase
    .from('obras' as any)
    .select('id, nome')
    .eq('ativo', true)
    .order('nome');

  return (
    <>
      <Header breadcrumbs={[{ label: 'Relatórios e Exportações' }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <RelatorioFvsCard obras={(obras as any[]) ?? []} />
        </div>
      </div>
    </>
  );
}
