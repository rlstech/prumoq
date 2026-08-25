import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import VerificacoesClient from './VerificacoesClient';
import { pageFromSearchParam, pageRange, pageSlice } from '@/lib/pagination';
import { getAuthContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

export default async function VerificacoesPage({ searchParams }: { searchParams?: { page?: string | string[] } }) {
  const supabase = await createClient();
  const context = await getAuthContext();
  const page = pageFromSearchParam(searchParams?.page);
  const { from, to } = pageRange(page);
  const { data: verifs } = await supabase
    .from('verificacoes' as any)
    .select('*, fvs_planejadas!verificacoes_fvs_planejada_id_fkey(subservico, ambientes!fvs_planejadas_ambiente_id_fkey(nome, obras!ambientes_obra_id_fkey(nome))), usuarios!inspetor_id(nome), verificacao_fotos!verificacao_fotos_verificacao_id_fkey(count)')
    .eq('cliente_id', context?.clienteId ?? '')
    .order('data_verif', { ascending: false })
    .range(from, to);
  const { rows, hasNextPage } = pageSlice((verifs as any[]) ?? []);

  return (
    <>
      <Header breadcrumbs={[{ label: 'Verificações' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
          <VerificacoesClient initialData={rows} page={page} hasNextPage={hasNextPage} />
        </div>
      </div>
    </>
  );
}
