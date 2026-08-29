import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import FvsEditorClient from './FvsEditorClient';

export default async function FvsPadraoDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const supabase = await createClient();

  const [
    { data: fvsData, error: fvsError },
    { data: itemsData },
    { data: logsData },
    { data: empresasData },
    { data: escopoData }
  ] = await Promise.all([
    supabase.from('fvs_padrao' as any).select('*, fvs_planejadas!fvs_planejadas_fvs_padrao_id_fkey(count)').eq('id', id).maybeSingle(),
    supabase.from('fvs_padrao_itens' as any).select('*').eq('fvs_padrao_id', id).order('ordem'),
    supabase.from('fvs_padrao_revisoes' as any).select('*, usuarios(nome)').eq('fvs_padrao_id', id).order('created_at', { ascending: false }),
    supabase.from('empresas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('fvs_padrao_empresas').select('empresa_id').eq('fvs_padrao_id', id)
  ]);

  if (fvsError) {
    throw new Error(`Não foi possível carregar a FVS: ${fvsError.message}`);
  }
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
      
      <div className="prumo-page">
        <div className="prumo-page-inner">
          <PageHeader
            title={fvs.nome}
            description="Itens de verificação e revisões desta FVS padrão. Editar aqui não afeta fichas já planejadas em obras — só a próxima associação."
          />
          <FvsEditorClient
            fvs={fvs}
            initialItems={itemsData as any[] || []}
            logs={logsData as any[] || []}
            empresas={empresasData ?? []}
            initialEmpresaIds={(escopoData ?? []).map(item => item.empresa_id)}
          />
        </div>
      </div>
    </>
  );
}
