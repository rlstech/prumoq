import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import FvsPadraoClient from './FvsPadraoClient';
import KPICard from '@/components/ui/KPICard';
import { ClipboardList } from 'lucide-react';
import { pageFromSearchParam, pageRange, pageSlice } from '@/lib/pagination';
import { getAuthContext } from '@/lib/auth/context';

export default async function FvsPadraoPage({ searchParams }: { searchParams?: { page?: string | string[] } }) {
  const supabase = await createClient();
  const context = await getAuthContext();
  const page = pageFromSearchParam(searchParams?.page);
  const { from, to } = pageRange(page);

  const [
    { data: fvsList, error: fvsError },
    { data: empresas },
    { count: total },
    { count: ativas },
    { count: inativas },
    { count: revisoes },
  ] = await Promise.all([
    supabase
      .from('fvs_padrao')
      .select('*, fvs_padrao_itens_current(count), fvs_planejadas!fvs_planejadas_fvs_padrao_id_fkey(count), fvs_padrao_empresas!fvs_padrao_empresas_fvs_padrao_id_fkey(empresa_id)')
      .eq('cliente_id', context?.clienteId ?? '')
      .order('nome')
      .range(from, to),
    supabase.from('empresas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('fvs_padrao').select('*', { count: 'exact', head: true }).eq('cliente_id', context?.clienteId ?? ''),
    supabase.from('fvs_padrao').select('*', { count: 'exact', head: true }).eq('cliente_id', context?.clienteId ?? '').eq('ativo', true),
    supabase.from('fvs_padrao').select('*', { count: 'exact', head: true }).eq('cliente_id', context?.clienteId ?? '').eq('ativo', false),
    supabase.from('fvs_padrao_revisoes').select('*', { count: 'exact', head: true }).eq('cliente_id', context?.clienteId ?? ''),
  ]);

  const { rows: typedFvs, hasNextPage } = pageSlice((fvsList as any[]) || []);

  const contagens = {
    total: total ?? 0,
    ativas: ativas ?? 0,
    inativas: inativas ?? 0,
    revisoes: revisoes ?? 0,
  };

  return (
    <>
      <Header breadcrumbs={[{ label: 'FVS Padrão (Biblioteca)' }]} />
      
      <div className="prumo-page">
        <div className="prumo-page-inner">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Total Cadastradas" value={contagens.total} icon={<ClipboardList size={20} />} />
          <KPICard title="Ativas" value={contagens.ativas} colorVariant="ok" />
          <KPICard title="Inativas" value={contagens.inativas} colorVariant="default" />
          <KPICard title="Revisões" value={contagens.revisoes} colorVariant="brand" />
        </div>

        <FvsPadraoClient
          initialData={typedFvs}
          empresas={empresas ?? []}
          page={page}
          hasNextPage={hasNextPage}
          loadError={fvsError ? 'Não foi possível carregar a biblioteca de FVS. Atualize a página ou tente novamente.' : undefined}
        />
        </div>
      </div>
    </>
  );
}
