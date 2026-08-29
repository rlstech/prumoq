'use client';

import { useState, useTransition } from 'react';
import { Landmark, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { updateNcFinancialImpact, type NcFinancialInput } from './actions';

type Props = {
  ncId: string;
  initial: Partial<NcFinancialInput>;
  users: { id: string; nome: string }[];
  history: { id: string; situacao: string | null; bloqueio: string | null; created_at: string; alterado_por: string | null }[];
};

const situationLabels: Record<NcFinancialInput['situacao'], string> = {
  sem_impacto: 'Sem impacto financeiro',
  em_avaliacao: 'Em avaliação',
  estimado: 'Impacto estimado',
  confirmado: 'Impacto confirmado',
};

export default function NcFinancialPanel({ ncId, initial, users, history }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<NcFinancialInput>({
    situacao: initial.situacao ?? 'em_avaliacao',
    bloqueio: initial.bloqueio ?? 'nao',
    justificativaSemImpacto: initial.justificativaSemImpacto ?? null,
    responsavelAvaliacaoId: initial.responsavelAvaliacaoId ?? null,
    prazoAvaliacao: initial.prazoAvaliacao ?? null,
    valorEstimado: initial.valorEstimado ?? null,
    valorConfirmado: initial.valorConfirmado ?? null,
    responsavelFinanceiro: initial.responsavelFinanceiro ?? null,
    categoriaFinanceira: initial.categoriaFinanceira ?? null,
    valorBloqueado: initial.valorBloqueado ?? null,
    observacao: initial.observacao ?? null,
    documento: initial.documento ?? null,
  });
  const requiresValue = form.situacao === 'estimado' || form.situacao === 'confirmado';

  function set<K extends keyof NcFinancialInput>(key: K, value: NcFinancialInput[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function submit() {
    startTransition(async () => {
      const result = await updateNcFinancialImpact(ncId, form);
      if (!result.success) {
        toast(result.error ?? 'Não foi possível salvar.', 'error');
        return;
      }
      toast('Impacto financeiro atualizado e auditado.', 'success');
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-brd-0 bg-bg-1 p-4">
      <div className="flex items-center gap-2"><Landmark size={17} className="text-[var(--br)]" /><div><h2 className="text-sm font-semibold text-txt">Impacto financeiro</h2><p className="text-xs text-txt-3">Obrigatório nesta obra. O histórico de alterações é preservado.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Situação"><select value={form.situacao} onChange={event => set('situacao', event.target.value as NcFinancialInput['situacao'])}><option value="sem_impacto">{situationLabels.sem_impacto}</option><option value="em_avaliacao">{situationLabels.em_avaliacao}</option><option value="estimado">{situationLabels.estimado}</option><option value="confirmado">{situationLabels.confirmado}</option></select></Field>
        <Field label="Bloqueia a medição?"><select value={form.bloqueio} onChange={event => set('bloqueio', event.target.value as NcFinancialInput['bloqueio'])}><option value="nao">Não</option><option value="total">Sim, totalmente</option><option value="parcial">Sim, parcialmente</option></select></Field>
        {form.situacao === 'sem_impacto' && <Field label="Justificativa"><input value={form.justificativaSemImpacto ?? ''} onChange={event => set('justificativaSemImpacto', event.target.value || null)} /></Field>}
        {form.situacao === 'em_avaliacao' && <><Field label="Responsável pela avaliação"><select value={form.responsavelAvaliacaoId ?? ''} onChange={event => set('responsavelAvaliacaoId', event.target.value || null)}><option value="">Selecione</option>{users.map(user=><option key={user.id} value={user.id}>{user.nome}</option>)}</select></Field><Field label="Prazo para definição"><input type="date" value={form.prazoAvaliacao ?? ''} onChange={event => set('prazoAvaliacao', event.target.value || null)} /></Field></>}
        {requiresValue && <><Field label={form.situacao === 'estimado' ? 'Valor estimado' : 'Valor confirmado'}><input type="number" min="0" step="0.01" value={form.situacao === 'estimado' ? form.valorEstimado ?? '' : form.valorConfirmado ?? ''} onChange={event => set(form.situacao === 'estimado' ? 'valorEstimado' : 'valorConfirmado', event.target.value ? Number(event.target.value) : null)} /></Field><Field label="Responsável financeiro"><select value={form.responsavelFinanceiro ?? ''} onChange={event => set('responsavelFinanceiro', (event.target.value || null) as NcFinancialInput['responsavelFinanceiro'])}><option value="">Selecione</option><option value="construtora">Construtora</option><option value="empreiteiro">Empreiteiro</option><option value="fornecedor">Fornecedor</option><option value="projetista">Projetista</option><option value="em_analise">Em análise</option></select></Field><Field label="Categoria"><select value={form.categoriaFinanceira ?? ''} onChange={event => set('categoriaFinanceira', (event.target.value || null) as NcFinancialInput['categoriaFinanceira'])}><option value="">Selecione</option><option value="mao_obra_retrabalho">Mão de obra de retrabalho</option><option value="perda_material">Perda de material</option><option value="equipamento_mobilizacao">Equipamento ou mobilização</option><option value="atraso">Atraso</option><option value="glosa_retencao">Glosa ou retenção</option><option value="desconto_empreiteiro">Desconto do empreiteiro</option><option value="outro">Outro</option></select></Field></>}
        {form.bloqueio === 'parcial' && <><Field label="Valor bloqueado (R$)"><input type="number" min="0" step="0.01" value={form.valorBloqueado ?? ''} onChange={event => set('valorBloqueado', event.target.value ? Number(event.target.value) : null)} /></Field>
          <div className="text-[11px] text-txt-3 sm:col-span-2">
            Valor descontado da medição quando o responsável financeiro é o empreiteiro executor do serviço. Ex.: medição de R$ 800 com R$ 200 bloqueados libera R$ 600.
          </div></>}
      </div>
      <Field label="Observação financeira"><textarea rows={2} value={form.observacao ?? ''} onChange={event => set('observacao', event.target.value || null)} /></Field>
      <Field label="Documento/evidência (chave R2 ou referência)"><input value={form.documento ?? ''} onChange={event => set('documento', event.target.value || null)} /></Field>
      <button type="button" onClick={submit} disabled={pending} className="prumo-primary-button mt-4 disabled:opacity-60"><Save size={15} />{pending ? 'Salvando...' : 'Salvar impacto'}</button>
      {history.length ? <div className="mt-5 border-t border-brd-0 pt-4"><h3 className="text-xs font-semibold uppercase tracking-wider text-txt-3">Histórico financeiro</h3><div className="mt-2 space-y-2">{history.map(item=><div key={item.id} className="rounded-lg bg-bg-0 p-3 text-xs text-txt-2"><b className="text-txt">{item.situacao?.replaceAll('_',' ') ?? 'Declaração'}</b> · bloqueio {item.bloqueio?.replaceAll('_',' ') ?? 'não informado'}<span className="block mt-1 text-txt-3">{new Date(item.created_at).toLocaleString('pt-BR')}</span></div>)}</div></div>:null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-txt-2">{label}<span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-brd-1 [&_input]:bg-bg-0 [&_input]:px-2.5 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-brd-1 [&_select]:bg-bg-0 [&_select]:px-2.5 [&_select]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-brd-1 [&_textarea]:bg-bg-0 [&_textarea]:px-2.5 [&_textarea]:py-2">{children}</span></label>;
}
