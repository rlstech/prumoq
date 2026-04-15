import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import FvsEditorClient from './FvsEditorClient';

export default async function FvsPadraoDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const supabase = await createClient();

  const [
    { data: fvsData },
    { data: itemsData },
    { data: logsData }
  ] = await Promise.all([
    supabase.from('fvs_padrao' as any).select('*, fvs_planejadas(count)').eq('id', id).single(),
    supabase.from('fvs_padrao_itens' as any).select('*').eq('fvs_padrao_id', id).order('ordem'),
    supabase.from('fvs_padrao_revisoes' as any).select('*, usuarios(nome)').eq('fvs_padrao_id', id).order('created_at', { ascending: false })
  ]);

  const fvs = fvsData as any;
  if (!fvs) return notFound();

  return (
    <>
      <Header 
        breadcrumbs={[
          { label: 'Biblioteca', href: '/fvs-padrao' },
          { label: fvs.nome }
        ]}
      />
      
      <div className="h-0 flex-1 overflow-auto bg-bg-0">
        <FvsEditorClient 
          fvs={fvs} 
          initialItems={itemsData as any[] || []} 
          logs={logsData as any[] || []} 
        />
      </div>
    </>
  );
}
