'use client';

import { useMemo, useState, useTransition } from 'react';
import { ArrowRightLeft, History, Ruler, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import type { Database } from '@prumoq/shared';
import { saveMeasurementConfig, swapMeasurementContractor, type MeasurementConfigInput, type MeasurementMethod } from './actions';

type Config = Database['public']['Tables']['fvs_medicao_configuracoes']['Row'];
type Stage = Database['public']['Tables']['fvs_medicao_etapas']['Row'];
type Link = Database['public']['Tables']['vinculos_execucao_servico']['Row'];
type Balance = Database['public']['Views']['vw_saldos_medicao_servico']['Row'];
type Advance = Database['public']['Tables']['avancos_aprovados_servico']['Row'];
type Measurement = Database['public']['Tables']['medicoes_servico']['Row'];
type MeasurementItem = Database['public']['Tables']['medicao_servico_itens']['Row'];
type Model = Database['public']['Tables']['modelos_etapas_medicao']['Row'] & { items: Database['public']['Tables']['modelo_etapas_medicao_itens']['Row'][] };
type Team = { id: string; nome: string; tipo: string };
type EditableStage = { ordem: number; nome: string; peso_percentual: number; permite_avanco_parcial: boolean; ativo: boolean };

function number(value: number | null | undefined) { return Number(value ?? 0); }
function fmt(value: number | null | undefined, digits = 2) { return number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits }); }
function money(value: number | null | undefined) { return number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function MeasurementServiceClient(props: {
  obraId: string; fvsId: string; title: string; enabled: boolean; config: Config | null; stages: Stage[]; links: Link[];
  balances: Balance[]; teams: Team[]; models: Model[]; advances: Advance[]; measurementItems: MeasurementItem[]; measurements: Measurement[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<MeasurementMethod>(props.config?.metodo ?? 'quantidade');
  const [unit, setUnit] = useState(props.config?.unidade ?? 'm²');
  const [total, setTotal] = useState(String(props.config?.quantidade_total ?? ''));
  const [price, setPrice] = useState(props.config?.preco_unitario == null ? '' : String(props.config.preco_unitario));
  const [partials, setPartials] = useState(props.config?.permite_medicoes_parciais ?? true);
  const [teamId, setTeamId] = useState(props.links.find(link => link.status === 'ativo')?.equipe_id ?? props.teams[0]?.id ?? '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [modelId, setModelId] = useState(props.config?.modelo_origem_id ?? '');
  const [stages, setStages] = useState<EditableStage[]>(props.stages.map(stage => ({ ordem: stage.ordem, nome: stage.nome, peso_percentual: number(stage.peso_percentual), permite_avanco_parcial: stage.permite_avanco_parcial, ativo: stage.ativo })));
  const [swapLink, setSwapLink] = useState<Link | null>(null);
  const [swapTeam, setSwapTeam] = useState('');
  const [swapDate, setSwapDate] = useState(new Date().toISOString().slice(0, 10));
  const [swapReason, setSwapReason] = useState('');

  const summary = useMemo(() => props.balances.reduce((acc, row) => ({
    approved: acc.approved + number(row.aprovado), measured: acc.measured + number(row.medido), blocked: acc.blocked + number(row.bloqueado), available: acc.available + number(row.disponivel), value: acc.value + number(row.valor_disponivel), scope: acc.scope + number(row.escopo_atribuido),
  }), { approved: 0, measured: 0, blocked: 0, available: 0, value: 0, scope: 0 }), [props.balances]);
  const teams = new Map(props.teams.map(team => [team.id, team.nome]));
  const measurements = new Map(props.measurements.map(item => [item.id, item]));

  function applyMethod(value: MeasurementMethod) {
    setMethod(value);
    if (value === 'unidade_concluida') { setUnit('un'); setTotal('1'); setPartials(false); setStages([]); }
    if (value === 'etapas_ponderadas') { setUnit('%'); setTotal('100'); setPartials(true); }
    if (value === 'quantidade') setStages([]);
  }
  function applyModel(value: string) {
    setModelId(value);
    const model = props.models.find(item => item.id === value);
    if (model) setStages(model.items.map(item => ({ ordem: item.ordem, nome: item.nome, peso_percentual: number(item.peso_percentual), permite_avanco_parcial: item.permite_avanco_parcial, ativo: item.ativo })));
  }
  function addStage() { setStages(current => [...current, { ordem: current.length + 1, nome: '', peso_percentual: 0, permite_avanco_parcial: false, ativo: true }]); }
  function save() {
    if (!teamId) { toast('Vincule uma equipe à obra e selecione o empreiteiro inicial.', 'error'); return; }
    if (!unit.trim()) { toast('Informe a unidade da medição.', 'error'); return; }
    if (!Number.isFinite(Number(total)) || Number(total) <= 0) { toast('Informe uma quantidade total maior que zero.', 'error'); return; }
    const payload: MeasurementConfigInput = { obraId: props.obraId, fvsId: props.fvsId, metodo: method, unidade: unit, quantidadeTotal: Number(total), precoUnitario: price ? Number(price) : null, permiteParciais: partials, modeloId: modelId || null, etapas: stages, equipeInicialId: teamId, dataInicio: startDate };
    startTransition(async () => {
      const result = await saveMeasurementConfig(payload);
      if (!result.success) return toast(result.error ?? 'Falha ao salvar.', 'error');
      toast('Configuração de medição salva.', 'success'); router.refresh();
    });
  }
  function confirmSwap() {
    if (!swapLink) return;
    startTransition(async () => {
      const result = await swapMeasurementContractor({ obraId: props.obraId, vinculoId: swapLink.id, novaEquipeId: swapTeam, data: swapDate, motivo: swapReason });
      if (!result.success) return toast(result.error ?? 'Falha na troca.', 'error');
      toast('Empreiteiro substituído sem alterar o histórico.', 'success'); setSwapLink(null); router.refresh();
    });
  }

  if (!props.enabled) return <section className="rounded-xl border border-dashed border-brd-1 bg-bg-1 p-8 text-sm text-txt-2">O controle de medições está desativado nesta obra. Ative-o nos recursos opcionais da obra.</section>;
  return <div className="space-y-5">
    <section className="rounded-xl border border-brd-0 bg-bg-1 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-txt-3">Serviço mensurável</p><h1 className="mt-1 text-xl font-semibold text-txt">{props.title}</h1>
      {props.config ? <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Previsto" value={`${fmt(summary.scope || props.config.quantidade_total)} ${props.config.unidade}`} /><Metric label="Aprovado" value={fmt(summary.approved)} /><Metric label="Medido" value={fmt(summary.measured)} /><Metric label="Bloqueado" value={fmt(summary.blocked)} tone="danger" /><Metric label="Disponível" value={fmt(summary.available)} tone="success" /><Metric label="Valor disponível" value={money(summary.value)} /></div> : null}
    </section>

    <section className="rounded-xl border border-brd-0 bg-bg-1 p-5"><div className="flex items-center gap-2"><Ruler size={17} className="text-brand" /><h2 className="text-sm font-semibold text-txt">Configuração da medição</h2></div>
      {props.config && props.advances.length ? <p className="mt-2 rounded-lg bg-warn-bg p-3 text-xs text-warn">Já existe avanço registrado. Para preservar o histórico, método, total e etapas não podem ser substituídos.</p> : null}
      {!props.teams.length ? <p className="mt-3 rounded-lg border border-warn/20 bg-warn-bg p-3 text-xs text-warn">Nenhuma equipe está vinculada a esta obra. <Link href={`/obras/${props.obraId}`} className="font-semibold underline">Vincule uma equipe na página da obra</Link> antes de configurar a medição.</p> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-3"><Field label="Método"><select value={method} onChange={e => applyMethod(e.target.value as MeasurementMethod)}><option value="quantidade">Quantidade</option><option value="unidade_concluida">Unidade concluída</option><option value="etapas_ponderadas">Etapas ponderadas</option></select></Field><Field label="Unidade"><input value={unit} onChange={e => setUnit(e.target.value)} disabled={method === 'etapas_ponderadas'} /></Field><Field label="Quantidade total"><input type="number" min="0" step="0.000001" value={total} onChange={e => setTotal(e.target.value)} disabled={method !== 'quantidade'} /></Field><Field label="Preço unitário"><input type="number" min="0" step="0.0001" value={price} onChange={e => setPrice(e.target.value)} /></Field><Field label="Empreiteiro inicial"><select value={teamId} onChange={e => setTeamId(e.target.value)}><option value="">Selecione</option>{props.teams.map(team => <option key={team.id} value={team.id}>{team.nome}</option>)}</select></Field><Field label="Início"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field></div>
      <label className="mt-3 flex items-center gap-2 text-xs text-txt-2"><input type="checkbox" checked={partials} onChange={e => setPartials(e.target.checked)} disabled={method === 'unidade_concluida'} /> Permitir medições parciais</label>
      {method === 'etapas_ponderadas' ? <div className="mt-5"><div className="flex items-end justify-between gap-3"><Field label="Modelo"><select value={modelId} onChange={e => applyModel(e.target.value)}><option value="">Personalizado / vazio</option>{props.models.map(model => <option key={model.id} value={model.id}>{model.nome}</option>)}</select></Field><span className={`text-xs font-semibold ${Math.abs(stages.filter(s => s.ativo).reduce((sum,s)=>sum+s.peso_percentual,0)-100)<0.00001?'text-ok':'text-nok'}`}>Total: {fmt(stages.filter(s=>s.ativo).reduce((sum,s)=>sum+s.peso_percentual,0),4)}%</span></div><div className="mt-3 space-y-2">{stages.map((stage,index)=><div key={index} className="grid gap-2 rounded-lg border border-brd-0 bg-bg-0 p-3 md:grid-cols-[60px_1fr_120px_150px_80px]"><input type="number" value={stage.ordem} onChange={e=>setStages(current=>current.map((s,i)=>i===index?{...s,ordem:Number(e.target.value)}:s))}/><input value={stage.nome} placeholder="Nome da etapa" onChange={e=>setStages(current=>current.map((s,i)=>i===index?{...s,nome:e.target.value}:s))}/><input type="number" step="0.0001" value={stage.peso_percentual} onChange={e=>setStages(current=>current.map((s,i)=>i===index?{...s,peso_percentual:Number(e.target.value)}:s))}/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={stage.permite_avanco_parcial} onChange={e=>setStages(current=>current.map((s,i)=>i===index?{...s,permite_avanco_parcial:e.target.checked}:s))}/> Avanço parcial</label><button type="button" className="text-xs text-nok" onClick={()=>setStages(current=>current.filter((_,i)=>i!==index).map((s,i)=>({...s,ordem:i+1})))}>Remover</button></div>)}</div><button type="button" onClick={addStage} className="mt-3 text-xs font-semibold text-brand">+ Adicionar etapa</button></div> : null}
      <button type="button" onClick={save} disabled={pending || !teamId || Boolean(props.config && props.advances.length)} className="prumo-primary-button mt-5 disabled:opacity-50"><Save size={15}/>{pending?'Salvando...':'Salvar configuração'}</button>
    </section>

    {props.config ? <section className="rounded-xl border border-brd-0 bg-bg-1 p-5"><div className="flex items-center gap-2"><ArrowRightLeft size={17} className="text-brand"/><h2 className="text-sm font-semibold text-txt">Responsáveis pela execução</h2></div><div className="mt-4 space-y-2">{props.links.map(link=>{const balance=props.balances.find(row=>row.vinculacao_id===link.id); return <div key={link.id} className="flex flex-col gap-3 rounded-lg border border-brd-0 p-3 md:flex-row md:items-center"><div className="flex-1"><div className="text-sm font-medium text-txt">{teams.get(link.equipe_id)??'Equipe'} {link.status==='ativo'?<span className="ml-2 rounded-full bg-ok-bg px-2 py-0.5 text-[10px] text-ok">Atual</span>:null}</div><div className="mt-1 text-xs text-txt-3">{link.data_inicio} {link.data_termino?`até ${link.data_termino}`:'até o momento'} · escopo {fmt(link.escopo_atribuido)}</div>{link.motivo_encerramento?<div className="mt-1 text-xs text-txt-2">{link.motivo_encerramento}</div>:null}</div><div className="text-xs text-txt-2">Aprovado {fmt(balance?.aprovado ?? link.aprovado_congelado)} · medido {fmt(balance?.medido ?? link.medido_congelado)} · disponível {fmt(balance?.disponivel)}</div>{link.status==='ativo'?<button type="button" onClick={()=>{setSwapLink(link);setSwapTeam('');setSwapReason('')}} className="prumo-row-button">Trocar empreiteiro</button>:null}</div>})}</div></section> : null}

    {props.advances.length || props.measurementItems.length ? <section className="rounded-xl border border-brd-0 bg-bg-1 p-5"><div className="flex items-center gap-2"><History size={17} className="text-brand"/><h2 className="text-sm font-semibold text-txt">Histórico cronológico</h2></div><div className="mt-4 divide-y divide-brd-0">{props.advances.map(a=><div key={a.id} className="py-3 text-xs"><b className="text-txt">Avanço aprovado</b><span className="ml-2 text-txt-2">{fmt(a.aprovado_anterior)} → {fmt(a.aprovado_atual)} {a.unidade} · {new Date(a.data_aprovacao).toLocaleString('pt-BR')}</span></div>)}{props.measurementItems.map(item=>{const header=measurements.get(item.medicao_id);return <div key={item.id} className="py-3 text-xs"><b className="text-txt">{item.tipo==='retrabalho'?'Retrabalho':'Medição'} {header?.referencia}</b><span className="ml-2 text-txt-2">{fmt(item.quantidade_periodo)} {item.unidade} · {money(item.valor_calculado)} · {header?.status}</span></div>})}</div></section>:null}

    {swapLink ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-xl bg-bg-1 p-5 shadow-xl"><h2 className="text-base font-semibold text-txt">Trocar empreiteiro</h2><p className="mt-2 text-xs leading-5 text-txt-2">O histórico de {teams.get(swapLink.equipe_id)} será congelado. Somente o escopo ainda não executado será atribuído ao novo responsável.</p><div className="mt-4 grid gap-3"><Field label="Novo empreiteiro"><select value={swapTeam} onChange={e=>setSwapTeam(e.target.value)}><option value="">Selecione</option>{props.teams.filter(t=>t.id!==swapLink.equipe_id).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field><Field label="Data da troca"><input type="date" value={swapDate} onChange={e=>setSwapDate(e.target.value)}/></Field><Field label="Motivo"><textarea value={swapReason} onChange={e=>setSwapReason(e.target.value)} rows={3}/></Field></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setSwapLink(null)} className="prumo-secondary-button">Cancelar</button><button type="button" onClick={confirmSwap} disabled={pending||!swapTeam||swapReason.trim().length<5} className="prumo-primary-button disabled:opacity-50">Confirmar troca</button></div></div></div> : null}
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success'|'danger' }) { return <div className="rounded-lg bg-bg-0 p-3"><div className="text-[10px] font-semibold uppercase text-txt-3">{label}</div><div className={`mt-1 text-sm font-semibold ${tone==='success'?'text-ok':tone==='danger'?'text-nok':'text-txt'}`}>{value}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-txt-2">{label}<span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-brd-1 [&_input]:bg-bg-0 [&_input]:px-2.5 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-brd-1 [&_select]:bg-bg-0 [&_select]:px-2.5 [&_select]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-brd-1 [&_textarea]:bg-bg-0 [&_textarea]:px-2.5 [&_textarea]:py-2">{children}</span></label>; }
