import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import StageModelsClient from './StageModelsClient';

export default async function StageModelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient();
  const { data: company } = await supabase.from('empresas').select('id,nome').eq('id', id).maybeSingle();
  if (!company) notFound();
  const { data: models } = await supabase.from('modelos_etapas_medicao').select('*').eq('empresa_id', id).order('nome');
  const ids=(models??[]).map(model=>model.id);
  const { data: items }=ids.length?await supabase.from('modelo_etapas_medicao_itens').select('*').in('modelo_id',ids).order('ordem'):{data:[]};
  return <><Header breadcrumbs={[{label:'Empresas',href:'/empresas'},{label:company.nome},{label:'Modelos de medição'}]}/><main className="prumo-page"><div className="prumo-page-inner"><StageModelsClient empresaId={id} models={(models??[]).map(model=>({...model,items:(items??[]).filter(item=>item.modelo_id===model.id)}))}/></div></main></>;
}
