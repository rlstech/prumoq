'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertObraInTenant, requireTenantRole } from '@/lib/auth/context';
import type { Json } from '@prumoq/shared';

async function requireWork(obraId:string){const context=await requireTenantRole(['admin','gestor']);await assertObraInTenant(obraId,context.clienteId);return context;}

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
 }catch(error){return {success:false,error:error instanceof Error?error.message:'Falha ao carregar saldos.',releases:[],rework:[]};}
}

const itemSchema=z.object({id:z.string().uuid().optional(),vinculacao_id:z.string().uuid(),verificacao_id:z.string().uuid().nullable(),nc_id:z.string().uuid().nullable(),tipo:z.enum(['avanco','retrabalho']),quantidade_anterior:z.number().nonnegative(),quantidade_atual:z.number().nonnegative(),quantidade_periodo:z.number().nonnegative(),quantidade_bloqueada:z.number().nonnegative(),unidade:z.string().min(1),preco_unitario:z.number().nonnegative().nullable(),valor_calculado:z.number().nonnegative(),liberacoes:z.array(z.object({avanco_id:z.string().uuid(),quantidade:z.number().positive()}))});
const draftSchema=z.object({medicaoId:z.string().uuid().nullable(),obraId:z.string().uuid(),equipeId:z.string().uuid(),referencia:z.string().trim().min(1),periodoInicio:z.string().date(),periodoFim:z.string().date(),dataMedicao:z.string().date(),observacao:z.string().nullable(),itens:z.array(itemSchema).min(1)});
export type MeasurementDraftInput=z.infer<typeof draftSchema>;
export async function saveMeasurementDraft(raw:MeasurementDraftInput){try{const input=draftSchema.parse(raw);await requireWork(input.obraId);const supabase=await createClient();const {data,error}=await supabase.rpc('salvar_medicao_rascunho',{p_medicao_id:input.medicaoId,p_obra_id:input.obraId,p_equipe_id:input.equipeId,p_referencia:input.referencia,p_periodo_inicio:input.periodoInicio,p_periodo_fim:input.periodoFim,p_data_medicao:input.dataMedicao,p_observacao:input.observacao,p_itens:input.itens as unknown as Json});if(error)throw error;revalidatePath('/medicoes');return{success:true,id:data};}catch(error){return{success:false,error:error instanceof Error?error.message:'Falha ao salvar medição.'};}}
export async function approveMeasurement(id:string,obraId:string){try{await requireWork(obraId);const supabase=await createClient();const{error}=await supabase.rpc('aprovar_medicao_servico',{p_medicao_id:id});if(error)throw error;revalidatePath('/medicoes');return{success:true};}catch(error){return{success:false,error:error instanceof Error?error.message:'Falha ao aprovar medição.'};}}
export async function cancelMeasurement(id:string,obraId:string,motivo:string){try{await requireWork(obraId);const supabase=await createClient();const{error}=await supabase.rpc('cancelar_medicao_servico',{p_medicao_id:id,p_motivo:motivo});if(error)throw error;revalidatePath('/medicoes');return{success:true};}catch(error){return{success:false,error:error instanceof Error?error.message:'Falha ao cancelar medição.'};}}
export async function discardMeasurement(id:string,obraId:string){try{await requireWork(obraId);const supabase=await createClient();const{error}=await supabase.rpc('descartar_medicao_rascunho',{p_medicao_id:id});if(error)throw error;revalidatePath('/medicoes');return{success:true};}catch(error){return{success:false,error:error instanceof Error?error.message:'Falha ao descartar medição.'};}}
