import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import FvsPlannerClient from './FvsPlannerClient';

export default async function AmbientePage(props: { params: Promise<{ id: string, ambId: string }> }) {
  const params = await props.params;
  const { id, ambId } = params;
  const supabase = await createClient();

  // Fetch ambiente with obra relations
  const { data: ambiente } = await supabase
    .from('ambientes' as any)
    .select('*, obras(nome, empresa_id)')
    .eq('id', ambId)
    .single();

  const typedAmb = ambiente as any;
  if (!typedAmb || typedAmb.obra_id !== id) return notFound();

  // Fetch FVS planejadas using RPC
  const { data: fvsList } = await (supabase.rpc as any)('get_fvs_ambiente', { p_ambiente_id: ambId });

  // Fetch available standard FVS for this company
  const { data: fvsPadraoList } = await supabase
    .from('fvs_padrao' as any)
    .select('id, nome, revisao_atual, categoria')
    .eq('empresa_id', typedAmb.obras?.empresa_id)
    .eq('ativo', true);

  return (
    <>
      <Header 
        breadcrumbs={[
          { label: 'Obras', href: '/obras' },
          { label: typedAmb.obras?.nome || 'Obra', href: `/obras/${id}` },
          { label: typedAmb.nome }
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <FvsPlannerClient 
          ambiente={typedAmb} 
          initialFvsList={fvsList || []} 
          fvsPadraoList={fvsPadraoList || []}
        />
      </div>
    </>
  );
}
