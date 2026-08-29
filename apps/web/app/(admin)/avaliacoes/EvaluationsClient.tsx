'use client';

import { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, FileDown, Plus, RotateCcw, Save, ShieldX } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import DataTable, { Column } from '@/components/ui/DataTable';
import Tabs from '@/components/ui/Tabs';
import { FilterBar, SelectFilter } from '@/components/ui/FilterBar';
import { useToast } from '@/components/ui/Toast';
import { approveEvaluation, invalidateEvaluation, reopenEvaluation, saveEvaluationModel } from './actions';
import Pagination from '@/components/ui/Pagination';

type Evaluation={id:string;obra_id:string;equipe_id:string;medicao_id:string|null;modelo_revisao_id:string;data_avaliacao:string;percentual:number;pontos_obtidos:number;pontos_possiveis:number;status:'rascunho'|'concluida'|'aguardando_aprovacao'|'aprovada'|'invalidada';avaliador_id:string;motivo_invalidacao:string|null};
type EvaluationMetric={status:Evaluation['status'];percentual:number};
type Model={id:string;empresa_id:string|null;nome:string;descricao:string|null;revisao_atual:number;ativo:boolean}; type Revision={id:string;modelo_id:string;numero_revisao:number}; type Criterion={revisao_id:string;ordem:number;titulo:string;peso:number};
const today=()=>new Date().toISOString().slice(0,10);

// Status labels/tones for this feature only — StatusBadge.tsx's shared map already
// uses the key 'concluida' for ObraStatus ("Concluída", ok/green), which would be
// misleading here: for an evaluation, 'concluida' means signed in the field and
// awaiting a gestor's decision, not a finished/good state.
const evaluationStatusConfig:Record<string,{label:string;className:string}>={
 rascunho:{label:'Rascunho',className:'bg-na-bg text-na border-na/20'},
 concluida:{label:'Aguardando aprovação',className:'bg-warn-bg text-warn border-warn/20'},
 aguardando_aprovacao:{label:'Aguardando aprovação',className:'bg-warn-bg text-warn border-warn/20'},
 aprovada:{label:'Aprovada',className:'bg-ok-bg text-ok border-ok/20'},
 invalidada:{label:'Invalidada',className:'bg-nok-bg text-nok border-nok/20'},
};
function EvaluationStatusBadge({status}:{status:string}){const config=evaluationStatusConfig[status]??{label:status,className:'bg-na-bg text-na border-na/20'};return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.className}`}>{config.label}</span>;}

// Ação de linha com o tom da própria ação (aprovar=ok, reabrir=warn, invalidar=nok) —
// mesma altura/raio de .prumo-row-button, mas preservando a cor semântica.
function RowActionIcon({tone,title,onClick,children}:{tone:'ok'|'warn'|'nok'|'neutral';title:string;onClick?:()=>void;children:React.ReactNode}){
  const toneClass = tone==='ok' ? 'bg-ok-bg text-ok hover:bg-ok/15' : tone==='warn' ? 'bg-warn-bg text-warn hover:bg-warn/15' : tone==='nok' ? 'bg-nok-bg text-nok hover:bg-nok/15' : 'bg-bg-0 text-txt-2 hover:bg-bg-2';
  return <button type="button" onClick={onClick} title={title} className={`inline-flex h-7 w-7 items-center justify-center rounded border border-transparent transition-colors ${toneClass}`}>{children}</button>;
}

export default function EvaluationsClient({evaluations,metrics,models,revisions,criteria,works,teams,companies,users,canManageModels,canDecide,page,hasNextPage}:{evaluations:Evaluation[];metrics:EvaluationMetric[];models:Model[];revisions:Revision[];criteria:Criterion[];works:{id:string;nome:string;empresa_id:string}[];teams:{id:string;nome:string;tipo:string}[];companies:{id:string;nome:string}[];users:{id:string;nome:string}[];canManageModels:boolean;canDecide:boolean;page:number;hasNextPage:boolean}) {
 const {toast}=useToast(); const [tab,setTab]=useState<'avaliacoes'|'modelos'>('avaliacoes'); const [model,setModel]=useState<Model|null>(null); const [approveId,setApproveId]=useState<string|null>(null); const [invalidateId,setInvalidateId]=useState<string|null>(null); const [reopenId,setReopenId]=useState<string|null>(null); const [reason,setReason]=useState(''); const [pending,start]=useTransition();
 const canManage=canDecide; void canManageModels;
 const [filter,setFilter]=useState(''); const filtered=useMemo(()=>evaluations.filter(item=>!filter||item.status===filter),[evaluations,filter]);
 const openModel=(item:Model|null)=>setModel(item??{id:'',empresa_id:null,nome:'',descricao:null,revisao_atual:0,ativo:true});
 const name=(rows:{id:string;nome:string}[],id:string)=>rows.find(row=>row.id===id)?.nome??'—';
 const currentCriteria=model?.id?criteria.filter(c=>revisions.find(r=>r.id===c.revisao_id&&r.modelo_id===model.id&&r.numero_revisao===model.revisao_atual)):[];
 const approveTarget=approveId?evaluations.find(item=>item.id===approveId)??null:null;
 // "Nota" only exists once an evaluation has been signed in the field — a rascunho's
 // percentual is always 0 by default, not a real score, so it stays out of the average.
 const scored=useMemo(()=>metrics.filter(m=>m.status==='concluida'||m.status==='aprovada'||m.status==='invalidada'),[metrics]);
 function submitModel(form:HTMLFormElement){const data=new FormData(form);const titles=data.getAll('criterion').map(String);const weights=data.getAll('weight').map(value=>Number(value));start(async()=>{const result=await saveEvaluationModel({id:model?.id||null,empresaId:String(data.get('empresa')||'')||null,nome:String(data.get('nome')||''),descricao:String(data.get('descricao')||'')||null,ativo:data.get('ativo')==='on',alteracoes:String(data.get('alteracoes')||''),criterios:titles.map((titulo,index)=>({titulo,peso:weights[index]}))});if(!result.success)return toast(result.error??'Erro ao publicar modelo.','error');toast('Revisão publicada.','success');setModel(null);});}
 function approve(){if(!approveId)return;start(async()=>{const result=await approveEvaluation(approveId);if(!result.success)return toast(result.error??'Não foi possível aprovar.','error');toast('Avaliação aprovada.','success');setApproveId(null);});}
 function invalidate(){if(!invalidateId)return;start(async()=>{const result=await invalidateEvaluation(invalidateId,reason);if(!result.success)return toast(result.error??'Não foi possível invalidar.','error');toast('Avaliação invalidada.','success');setInvalidateId(null);setReason('');});}
 function reopen(){if(!reopenId)return;start(async()=>{const result=await reopenEvaluation(reopenId,reason);if(!result.success)return toast(result.error??'Não foi possível reabrir.','error');toast('Avaliação reaberta. Continue a correção e assinatura no app mobile.','success');setReopenId(null);setReason('');});}

 const columns: Column<Evaluation>[] = [
   {
     header: 'Empreiteiro / obra',
     cell: item => <div><b className="text-[13px] text-txt">{name(teams,item.equipe_id)}</b><p className="mt-0.5 text-xs text-txt-3">{name(works,item.obra_id)} · {new Date(`${item.data_avaliacao}T12:00:00`).toLocaleDateString('pt-BR')}</p></div>,
   },
   {
     header: 'Modelo',
     cell: item => {
       const revision = revisions.find(r => r.id === item.modelo_revisao_id);
       const modelName = models.find(m => m.id === revision?.modelo_id)?.nome ?? 'Modelo';
       return <div className="text-xs text-txt-2">{modelName} · Rev. {revision?.numero_revisao ?? '—'}<p className="mt-0.5">{item.medicao_id ? 'Vinculada à medição' : 'Avaliação avulsa'}</p></div>;
     },
   },
   {
     header: 'Resultado',
     cell: item => <div><b className="prumo-metric text-[13px] text-txt">{Number(item.percentual).toFixed(0)}%</b><p className="mt-0.5 text-xs text-txt-3">{item.pontos_obtidos}/{item.pontos_possiveis}</p><div className="mt-1"><EvaluationStatusBadge status={item.status}/></div></div>,
   },
   {
     header: '',
     align: 'right',
     cell: item => (
       <div className="flex items-center justify-end gap-1.5">
         <a href={`/admin/relatorio/avaliacoes-empreiteiro/${item.id}/pdf`} title="Baixar PDF" className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent bg-bg-0 text-txt-2 transition-colors hover:bg-bg-2"><FileDown size={14}/></a>
         {canManage && item.status === 'concluida' ? <RowActionIcon tone="warn" title="Reabrir para correção" onClick={() => { setReason(''); setReopenId(item.id); }}><RotateCcw size={14}/></RowActionIcon> : null}
         {canManage && item.status === 'concluida' ? <RowActionIcon tone="ok" title="Aprovar" onClick={() => setApproveId(item.id)}><CheckCircle2 size={14}/></RowActionIcon> : null}
         {canManage && item.status === 'concluida' ? <RowActionIcon tone="nok" title="Invalidar" onClick={() => setInvalidateId(item.id)}><ShieldX size={14}/></RowActionIcon> : null}
       </div>
     ),
   },
 ];

 return <div className="space-y-5">
  {canManage ? <Tabs tabs={[{id:'avaliacoes',label:'Avaliações'},{id:'modelos',label:'Modelos'}]} value={tab} onChange={value=>setTab(value as 'avaliacoes'|'modelos')} ariaLabel="Seções de avaliação" /> : null}
  {tab==='avaliacoes'?<>
   <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <Metric label="Aguardando aprovação" value={String(metrics.filter(m=>m.status==='concluida').length)} tone="warn"/>
     <Metric label="Aprovadas" value={String(metrics.filter(m=>m.status==='aprovada').length)} tone="ok"/>
     <Metric label="Média" value={`${scored.length?Math.round(scored.reduce((sum,m)=>sum+Number(m.percentual),0)/scored.length):0}%`}/>
     <Metric label="Invalidada" value={String(metrics.filter(m=>m.status==='invalidada').length)} tone="nok"/>
   </section>
   <FilterBar resultLabel={`${filtered.length} de ${evaluations.length} avaliações`}>
     <SelectFilter label="Status:" value={filter} onChange={setFilter} options={[
       {value:'',label:'Todos'},
       {value:'rascunho',label:'Rascunho'},
       {value:'concluida',label:'Aguardando aprovação'},
       {value:'aprovada',label:'Aprovada'},
       {value:'invalidada',label:'Invalidada'},
     ]} />
   </FilterBar>
   <DataTable
     data={filtered}
     columns={columns}
     rowKey={item => item.id}
     emptyMessage="Nenhuma avaliação neste recorte"
     emptyHint="Ajuste o filtro de status acima para ver as avaliações registradas."
   />
  </>:<section className="space-y-3">
   <div className="flex justify-end">
     <button type="button" onClick={()=>openModel(null)} className="prumo-primary-button"><Plus size={15}/>Novo modelo</button>
   </div>
   <div className="prumo-panel overflow-hidden">
     {models.map(item=><button key={item.id} type="button" onClick={()=>openModel(item)} className="flex w-full items-center justify-between border-b border-brd-0 px-4 py-4 text-left last:border-0 hover:bg-bg-0"><span><b className="text-sm text-txt">{item.nome}</b><span className="ml-2 text-xs text-txt-3">Rev. {item.revisao_atual} · {item.empresa_id?name(companies,item.empresa_id):'Global'}</span></span><span className={item.ativo?'text-xs text-ok':'text-xs text-txt-3'}>{item.ativo?'Ativo':'Inativo'}</span></button>)}
   </div>
  </section>}
  {tab==='avaliacoes'?<Pagination page={page} hasNextPage={hasNextPage} pathname="/avaliacoes"/>:null}
  {model?<ModelModal model={model} companies={companies} criteria={currentCriteria} pending={pending} onClose={()=>setModel(null)} onSubmit={submitModel}/>:null}
  {approveId?<Modal isOpen onClose={()=>setApproveId(null)} title="Aprovar avaliação">
    {approveTarget?<p className="text-sm text-txt-2"><b className="text-txt">{name(teams,approveTarget.equipe_id)}</b> · {name(works,approveTarget.obra_id)} · nota <b className="prumo-metric text-txt">{Number(approveTarget.percentual).toFixed(0)}%</b></p>:null}
    <p className="mt-2 text-sm text-txt-2">A avaliação passa a valer como aprovada e libera a medição vinculada, se houver. Esta decisão não pode ser desfeita por aqui.</p>
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={()=>setApproveId(null)} className="prumo-secondary-button">Cancelar</button>
      <button type="button" disabled={pending} onClick={approve} className="inline-flex h-[38px] items-center gap-2 rounded bg-ok px-4 text-[13px] font-semibold text-white transition-colors hover:bg-ok/90 disabled:opacity-60"><CheckCircle2 size={15}/>Aprovar</button>
    </div>
  </Modal>:null}
  {invalidateId?<Modal isOpen onClose={()=>setInvalidateId(null)} title="Invalidar avaliação">
    <label className="block text-sm text-txt-2">Justificativa<textarea value={reason} onChange={e=>setReason(e.target.value)} className="prumo-field mt-2 min-h-24 p-3" rows={3}/></label>
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={()=>setInvalidateId(null)} className="prumo-secondary-button">Voltar</button>
      <button type="button" disabled={pending||reason.trim().length<3} onClick={invalidate} className="inline-flex h-[38px] items-center gap-2 rounded bg-nok px-4 text-[13px] font-semibold text-white transition-colors hover:bg-nok/90 disabled:opacity-60">Invalidar</button>
    </div>
  </Modal>:null}
  {reopenId?<Modal isOpen onClose={()=>setReopenId(null)} title="Reabrir avaliação">
    <p className="text-sm text-txt-2">A avaliação voltará para rascunho, preservando a trilha de auditoria. A correção e nova assinatura devem ser feitas no app mobile.</p>
    <label className="mt-4 block text-sm text-txt-2">Motivo da reabertura<textarea value={reason} onChange={e=>setReason(e.target.value)} className="prumo-field mt-2 min-h-24 p-3" rows={3}/></label>
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={()=>setReopenId(null)} className="prumo-secondary-button">Cancelar</button>
      <button type="button" disabled={pending||reason.trim().length<3} onClick={reopen} className="inline-flex h-[38px] items-center gap-2 rounded bg-warn px-4 text-[13px] font-semibold text-white transition-colors hover:bg-warn/90 disabled:opacity-60"><RotateCcw size={15}/>Reabrir</button>
    </div>
  </Modal>:null}
 </div>;
}
function Metric({label,value,tone}:{label:string;value:string;tone?:'ok'|'warn'|'nok'}){return <div className="prumo-panel p-4"><p className="text-xs text-txt-3">{label}</p><p className={`prumo-metric mt-1 text-2xl font-semibold ${tone==='nok'?'text-nok':tone==='warn'?'text-warn':tone==='ok'?'text-ok':'text-txt'}`}>{value}</p></div>}
function ModelModal({model,companies,criteria,pending,onClose,onSubmit}:{model:Model;companies:{id:string;nome:string}[];criteria:Criterion[];pending:boolean;onClose:()=>void;onSubmit:(form:HTMLFormElement)=>void}){
  const initial=criteria.length?criteria:[{titulo:'Cumprimento de prazos',peso:10},{titulo:'Qualidade dos serviços executados',peso:10}];
  const [rows,setRows]=useState(initial);
  return <Modal isOpen onClose={onClose} title={model.id?'Publicar nova revisão':'Novo modelo'} size="lg">
    <form onSubmit={e=>{e.preventDefault();onSubmit(e.currentTarget)}} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-txt-2">Nome<input name="nome" defaultValue={model.nome} className="prumo-field mt-1" required/></label>
        <label className="text-sm text-txt-2">Escopo<select name="empresa" defaultValue={model.empresa_id??''} className="prumo-field mt-1"><option value="">Global do cliente</option>{companies.map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}</select></label>
      </div>
      <label className="block text-sm text-txt-2">Descrição<textarea name="descricao" defaultValue={model.descricao??''} className="prumo-field mt-1 min-h-16 p-3" rows={2}/></label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-txt">Critérios</legend>
        {rows.map((row,index)=><div key={index} className="flex gap-2">
          <input name="criterion" value={row.titulo} onChange={e=>setRows(rows.map((r,i)=>i===index?{...r,titulo:e.target.value}:r))} className="prumo-field flex-1 text-sm"/>
          <input name="weight" type="number" min="1" max="10" value={row.peso} onChange={e=>setRows(rows.map((r,i)=>i===index?{...r,peso:Number(e.target.value)}:r))} className="prumo-field w-20 text-sm"/>
          <button type="button" onClick={()=>setRows(rows.filter((_,i)=>i!==index))} className="px-2 text-nok" aria-label="Remover critério">×</button>
        </div>)}
        <button type="button" onClick={()=>setRows([...rows,{titulo:'',peso:1}])} className="text-sm font-semibold text-[var(--br)]">+ Adicionar critério</button>
      </fieldset>
      <label className="block text-sm text-txt-2">Alterações desta revisão<input name="alteracoes" placeholder="Descreva o que mudou" className="prumo-field mt-1" required/></label>
      <label className="flex items-center gap-2 text-sm text-txt"><input name="ativo" type="checkbox" defaultChecked={model.ativo}/> Modelo ativo</label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="prumo-secondary-button">Cancelar</button>
        <button type="submit" disabled={pending||!rows.length} className="prumo-primary-button disabled:opacity-60"><Save size={15}/>{pending?'Publicando...':'Publicar revisão'}</button>
      </div>
    </form>
  </Modal>;
}
