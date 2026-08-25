'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertObraInTenant, requireTenantRole } from '@/lib/auth/context';
import type { Database, Json } from '@prumoq/shared';

async function requireWork(obraId:string){const context=await requireTenantRole(['admin','gestor']);await assertObraInTenant(obraId,context.clienteId);return context;}

function errorMessage(error:unknown,fallback:string):string{
  if(error instanceof Error)return error.message;
  const msg=(error as {message?:unknown}|null)?.message;
  if(typeof msg==='string')return msg;
  if(msg&&typeof msg==='object'){const inner=(msg as {message?:unknown}).message;if(typeof inner==='string')return inner;}
  return fallback;
}

export async function loadMeasurementOptions(obraId:string,equipeId:string){
 try{
  await requireWork(obraId); const supabase=await createClient();
  const {data:balances,error}=await supabase.from('vw_saldos_medicao_servico').select('*').eq('obra_id',obraId).eq('equipe_id',equipeId).gt('disponivel',0);
  if(error)throw error; const linkIds=(balances??[]).map(row=>row.vinculacao_id).filter((id):id is string=>Boolean(id));
  const {data:links}=linkIds.length?await supabase.from('vinculos_execucao_servico').select('*').in('id',linkIds):{data:[]};
  const fvsIds=(links??[]).map(link=>link.fvs_planejada_id);
  const [{data:configs},{data:fvs},{data:stages},{data:advances}]=await Promise.all([
   fvsIds.length?supabase.from('fvs_medicao_configuracoes').select('*').in('fvs_planejada_id',fvsIds):Promise.resolve({data:[]}),
   fvsIds.length?supabase.from('fvs_planejadas').select('id,subservico,ambiente_id').in('id',fvsIds):Promise.resolve({data:[]}),
   linkIds.length?supabase.from('fvs_medicao_etapas').select('*').in('id',(links??[]).map(link=>link.etapa_id).filter((id):id is string=>Boolean(id))):Promise.resolve({data:[]}),
   linkIds.length?supabase.from('avancos_aprovados_servico').select('*').in('vinculacao_id',linkIds).order('data_aprovacao'):Promise.resolve({data:[]}),
  ]);
  const advanceIds=(advances??[]).map(item=>item.id); const {data:used}=advanceIds.length?await supabase.from('medicao_item_liberacoes').select('avanco_id,quantidade_utilizada').in('avanco_id',advanceIds).eq('ativa',true):{data:[]};
  const usedByAdvance=new Map<string,number>();(used??[]).forEach(item=>usedByAdvance.set(item.avanco_id,(usedByAdvance.get(item.avanco_id)??0)+Number(item.quantidade_utilizada)));
  // Saldo disponível por vínculo (já desconta aprovado medido e bloqueios de NC
  // por valor — ex.: medição de R$ 800 com R$ 200 bloqueados libera R$ 600).
  const availableByVinculo=new Map<string,number>();
  (balances??[]).forEach(row=>{if(row.vinculacao_id)availableByVinculo.set(row.vinculacao_id,Number(row.disponivel??0));});
  const releases=(advances??[]).flatMap(item=>{
   const remaining=availableByVinculo.get(item.vinculacao_id)??0;
   if(remaining<=0)return[];
   const rawAvailable=Number(item.aprovado_atual)-Number(item.aprovado_anterior)-(usedByAdvance.get(item.id)??0);
   const available=Math.min(rawAvailable,remaining);
   availableByVinculo.set(item.vinculacao_id,remaining-available);
   if(available<=0)return[];
   const link=(links??[]).find(value=>value.id===item.vinculacao_id);const planned=(fvs??[]).find(value=>value.id===link?.fvs_planejada_id);const config=(configs??[]).find(value=>value.fvs_planejada_id===link?.fvs_planejada_id);const stage=(stages??[]).find(value=>value.id===link?.etapa_id);return[{id:item.id,vinculacaoId:item.vinculacao_id,verificacaoId:item.verificacao_id,fvsId:link?.fvs_planejada_id??'',service:planned?.subservico??'Serviço',stage:stage?.nome??null,previous:Number(item.aprovado_anterior),current:Number(item.aprovado_atual),quantity:available,unit:config?.unidade??item.unidade,unitPrice:config?.preco_unitario==null?null:Number(config.preco_unitario)}];
  });
  const {data:verifications}=fvsIds.length?await supabase.from('verificacoes').select('id,fvs_planejada_id').in('fvs_planejada_id',fvsIds):{data:[]};
  const verificationIds=(verifications??[]).map(item=>item.id);const {data:ncs}=verificationIds.length?await supabase.from('nao_conformidades').select('id,verificacao_id,descricao,valor_confirmado,categoria_financeira,situacao_financeira').in('verificacao_id',verificationIds).eq('situacao_financeira','confirmado').gt('valor_confirmado',0):{data:[]};
  const rework=(ncs??[]).flatMap(nc=>{const verification=(verifications??[]).find(item=>item.id===nc.verificacao_id);const link=(links??[]).find(item=>item.fvs_planejada_id===verification?.fvs_planejada_id&&item.status==='ativo');const planned=(fvs??[]).find(item=>item.id===verification?.fvs_planejada_id);return link?[{ncId:nc.id,vinculacaoId:link.id,service:planned?.subservico??'Serviço',description:nc.descricao,value:Number(nc.valor_confirmado??0),category:nc.categoria_financeira}]:[];});
  return {success:true,releases,rework};
 }catch(error){return {success:false,error:errorMessage(error,'Falha ao carregar saldos.'),releases:[],rework:[]};}
}

const itemSchema=z.object({id:z.string().uuid().optional(),vinculacao_id:z.string().uuid(),verificacao_id:z.string().uuid().nullable(),nc_id:z.string().uuid().nullable(),tipo:z.enum(['avanco','retrabalho']),quantidade_anterior:z.number().nonnegative(),quantidade_atual:z.number().nonnegative(),quantidade_periodo:z.number().nonnegative(),quantidade_bloqueada:z.number().nonnegative(),unidade:z.string().min(1),preco_unitario:z.number().nonnegative().nullable(),valor_calculado:z.number().nonnegative(),liberacoes:z.array(z.object({avanco_id:z.string().uuid(),quantidade:z.number().positive()}))});
const draftSchema=z.object({medicaoId:z.string().uuid().nullable(),obraId:z.string().uuid(),equipeId:z.string().uuid(),referencia:z.string().trim().min(1),periodoInicio:z.string().date(),periodoFim:z.string().date(),dataMedicao:z.string().date(),observacao:z.string().nullable(),itens:z.array(itemSchema).min(1)});
export type MeasurementDraftInput=z.infer<typeof draftSchema>;
export async function saveMeasurementDraft(raw:MeasurementDraftInput){try{const input=draftSchema.parse(raw);await requireWork(input.obraId);const supabase=await createClient();const {data,error}=await supabase.rpc('salvar_medicao_rascunho',{p_medicao_id:input.medicaoId,p_obra_id:input.obraId,p_equipe_id:input.equipeId,p_referencia:input.referencia,p_periodo_inicio:input.periodoInicio,p_periodo_fim:input.periodoFim,p_data_medicao:input.dataMedicao,p_observacao:input.observacao,p_itens:input.itens as unknown as Json});if(error)throw error;revalidatePath('/medicoes');return{success:true,id:data};}catch(error){return{success:false,error:errorMessage(error,'Falha ao salvar medição.')};}}
export async function approveMeasurement(id:string,obraId:string){try{await requireWork(obraId);const supabase=await createClient();const{error}=await supabase.rpc('aprovar_medicao_servico',{p_medicao_id:id});if(error)throw error;revalidatePath('/medicoes');return{success:true};}catch(error){return{success:false,error:errorMessage(error,'Falha ao aprovar medição.')};}}
export async function cancelMeasurement(id:string,obraId:string,motivo:string){try{await requireWork(obraId);const supabase=await createClient();const{error}=await supabase.rpc('cancelar_medicao_servico',{p_medicao_id:id,p_motivo:motivo});if(error)throw error;revalidatePath('/medicoes');return{success:true};}catch(error){return{success:false,error:errorMessage(error,'Falha ao cancelar medição.')};}}
export async function discardMeasurement(id:string,obraId:string){try{await requireWork(obraId);const supabase=await createClient();const{error}=await supabase.rpc('descartar_medicao_rascunho',{p_medicao_id:id});if(error)throw error;revalidatePath('/medicoes');return{success:true};}catch(error){return{success:false,error:errorMessage(error,'Falha ao descartar medição.')};}}

type MeasurementRow=Database['public']['Tables']['medicoes_servico']['Row'];
type ItemRow=Database['public']['Tables']['medicao_servico_itens']['Row'];
type ReleaseRow=Database['public']['Tables']['medicao_item_liberacoes']['Row'];
type AdvanceRow=Database['public']['Tables']['avancos_aprovados_servico']['Row'];
type BalanceRow=Database['public']['Views']['vw_saldos_medicao_servico']['Row'];

export type MeasurementDetailItem=ItemRow & {
  servico:string; etapa_nome:string|null; equipe_nome:string|null;
  liberacoes:Array<{avanco_id:string;quantidade_utilizada:number;aprovado_anterior:number;aprovado_atual:number;data_aprovacao:string|null}>;
  nc_descricao:string|null; nc_numero_ocorrencia:number|null;
};
export type MeasurementDetailBlocker={
  nc_id:string; numero_ocorrencia:number; descricao:string; status:string;
  bloqueio_medicao:string|null; valor_bloqueado:number|null; situacao_financeira:string|null;
};
export type MeasurementDetailBalance={vinculacao_id:string|null;bloqueado:number|null;valor_bloqueado:number|null;disponivel:number|null;valor_disponivel:number|null;aprovado:number|null;medido:number|null};
export type MeasurementDetail={
  measurement:MeasurementRow; obra_nome:string; equipe_nome:string;
  criado_por_nome:string|null; aprovado_por_nome:string|null; cancelado_por_nome:string|null;
  itens:MeasurementDetailItem[]; bloqueios:MeasurementDetailBlocker[]; saldos:MeasurementDetailBalance[];
};

export async function getMeasurementDetail(medicaoId:string):Promise<{success:true;detail:MeasurementDetail}|{success:false;error:string}>{
 try{
  const context=await requireTenantRole(['admin','gestor']);
  const supabase=await createClient();
  const {data:measurement,error:mError}=await supabase.from('medicoes_servico').select('*').eq('id',medicaoId).maybeSingle();
  if(mError||!measurement)throw new Error('Medição não encontrada.');
  await assertObraInTenant(measurement.obra_id,context.clienteId);

  const [{data:obra},{data:equipe},{data:items}]=await Promise.all([
   supabase.from('obras').select('nome').eq('id',measurement.obra_id).maybeSingle(),
   supabase.from('equipes').select('nome').eq('id',measurement.equipe_id).maybeSingle(),
   supabase.from('medicao_servico_itens').select('*').eq('medicao_id',medicaoId).order('created_at'),
  ]);
  const itemRows=(items??[]) as ItemRow[];
  const linkIds=Array.from(new Set(itemRows.map(i=>i.vinculacao_id)));
  const releaseIds=Array.from(new Set(itemRows.map(i=>i.id)));
  const ncIds=itemRows.map(i=>i.nc_id).filter((id):id is string=>Boolean(id));
  const userIds=[measurement.criado_por,measurement.aprovado_por,measurement.cancelado_por].filter((id):id is string=>Boolean(id));

  const [{data:links},{data:releases},{data:ncRows},{data:balances},{data:users}]=await Promise.all([
   linkIds.length?supabase.from('vinculos_execucao_servico').select('*').in('id',linkIds):Promise.resolve({data:[]}),
   releaseIds.length?supabase.from('medicao_item_liberacoes').select('*').in('medicao_item_id',releaseIds).eq('ativa',true):Promise.resolve({data:[]}),
   ncIds.length?supabase.from('nao_conformidades').select('id,descricao,numero_ocorrencia').in('id',ncIds):Promise.resolve({data:[]}),
   linkIds.length?supabase.from('vw_saldos_medicao_servico').select('vinculacao_id,bloqueado,valor_bloqueado,disponivel,valor_disponivel,aprovado,medido').in('vinculacao_id',linkIds):Promise.resolve({data:[]}),
   userIds.length?supabase.from('usuarios').select('id,nome').in('id',userIds):Promise.resolve({data:[]}),
  ]);
  const advanceIds=Array.from(new Set((releases??[] as ReleaseRow[]).map(r=>r.avanco_id)));
  const {data:advanceRowsRaw}=advanceIds.length?await supabase.from('avancos_aprovados_servico').select('*').in('id',advanceIds):{data:[]};
  const advanceRows=(advanceRowsRaw??[]) as AdvanceRow[];
  const advanceById=new Map(advanceRows.map(a=>[a.id,a]));
  const fvsIds=Array.from(new Set((links??[]).map(l=>l.fvs_planejada_id)));
  const {data:fvsRows}=fvsIds.length?await supabase.from('fvs_planejadas').select('id,subservico').in('id',fvsIds):{data:[]};
  const fvsName=new Map((fvsRows??[]).map(f=>[f.id,f.subservico]));

  // Bloqueios de medição por RNC: NCs abertas/em correção com bloqueio total/parcial
  // sobre os vínculos usados nesta medição (desconto por valor — migration 059).
  const verifIds=Array.from(new Set(advanceRows.map(a=>a.verificacao_id)));
  const {data:blockerRows}=verifIds.length?await supabase.from('nao_conformidades').select('id,verificacao_id,numero_ocorrencia,descricao,status,bloqueio_medicao,valor_bloqueado,situacao_financeira').in('verificacao_id',verifIds).in('status',['aberta','em_correcao']):{data:[]};
  const advanceVerifByLink=new Map<string,string>();
  for(const a of advanceRows){if(a.vinculacao_id&&!advanceVerifByLink.has(a.vinculacao_id))advanceVerifByLink.set(a.vinculacao_id,a.verificacao_id);}
  const bloqueios=(blockerRows??[]).filter(n=>n.bloqueio_medicao&&n.bloqueio_medicao!=='nao'&&Array.from(advanceVerifByLink.values()).includes(n.verificacao_id));

  const teamByName=new Map((equipe?[[measurement.equipe_id,equipe.nome??'']]:[]));
  const linkById=new Map((links??[]).map(l=>[l.id,l]));
  const stageIds=Array.from(new Set(itemRows.map(i=>i.etapa_id).filter((id):id is string=>Boolean(id))));
  const {data:stageRows}=stageIds.length?await supabase.from('fvs_medicao_etapas').select('id,nome').in('id',stageIds):{data:[]};
  const stageName=new Map((stageRows??[]).map(s=>[s.id,s.nome]));
  const ncById=new Map((ncRows??[]).map(n=>[n.id,n]));
  const userById=new Map((users??[]).map(u=>[u.id,u.nome]));
  const releaseByItem=new Map<string,ReleaseRow[]>();
  for(const r of (releases??[] as ReleaseRow[])){const list=releaseByItem.get(r.medicao_item_id)??[];list.push(r);releaseByItem.set(r.medicao_item_id,list);}

  const itens:MeasurementDetailItem[]=itemRows.map(item=>{
   const link=linkById.get(item.vinculacao_id);
   return {
    ...item,
    servico:fvsName.get(link?.fvs_planejada_id??'')??'Serviço',
    etapa_nome:item.etapa_id?stageName.get(item.etapa_id)??null:null,
    equipe_nome:link?teamByName.get(link.equipe_id)??null:null,
    liberacoes:(releaseByItem.get(item.id)??[]).map(r=>{const a=advanceById.get(r.avanco_id);return{avanco_id:r.avanco_id,quantidade_utilizada:Number(r.quantidade_utilizada),aprovado_anterior:a?Number(a.aprovado_anterior):0,aprovado_atual:a?Number(a.aprovado_atual):0,data_aprovacao:a?.data_aprovacao??null};}),
    nc_descricao:item.nc_id?ncById.get(item.nc_id)?.descricao??null:null,
    nc_numero_ocorrencia:item.nc_id?ncById.get(item.nc_id)?.numero_ocorrencia??null:null,
   };
  });

  return {
   success:true,
   detail:{
    measurement,
    obra_nome:obra?.nome??'',
    equipe_nome:equipe?.nome??'',
    criado_por_nome:userById.get(measurement.criado_por)??null,
    aprovado_por_nome:measurement.aprovado_por?userById.get(measurement.aprovado_por)??null:null,
    cancelado_por_nome:measurement.cancelado_por?userById.get(measurement.cancelado_por)??null:null,
    itens,
    bloqueios:bloqueios.map(n=>({nc_id:n.id,numero_ocorrencia:Number(n.numero_ocorrencia),descricao:n.descricao,status:n.status,bloqueio_medicao:n.bloqueio_medicao,valor_bloqueado:n.valor_bloqueado==null?null:Number(n.valor_bloqueado),situacao_financeira:n.situacao_financeira})),
    saldos:(balances??[] as BalanceRow[]).map(b=>({vinculacao_id:b.vinculacao_id,bloqueado:b.bloqueado==null?null:Number(b.bloqueado),valor_bloqueado:b.valor_bloqueado==null?null:Number(b.valor_bloqueado),disponivel:b.disponivel==null?null:Number(b.disponivel),valor_disponivel:b.valor_disponivel==null?null:Number(b.valor_disponivel),aprovado:b.aprovado==null?null:Number(b.aprovado),medido:b.medido==null?null:Number(b.medido)})),
   },
  };
 }catch(error){return{success:false,error:errorMessage(error,'Falha ao carregar detalhe da medição.')};}
}
