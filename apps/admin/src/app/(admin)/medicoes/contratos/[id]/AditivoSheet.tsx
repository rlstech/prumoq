import { useState, useTransition } from 'react';
import { Plus } from '@/components/icons';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { hojeEmBrasilia } from '@/lib/dates';
import { applyAmendment, type AmendmentInput } from '../../actions';
import { money, num } from '../../format';
import type { Contract } from '../../types';
import ServicePicker, { draftPrice, draftQuantity, draftValid, parseDecimal, type ServiceDrafts } from './ServicePicker';
import type { ServiceRow } from './types';

const toInput = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
const same = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9);

type Edit = { quantidade: string; preco: string };

/**
 * Aditivo do contrato: muda quantidade e preço dos itens e inclui serviços. Vale na hora.
 * Medições já aprovadas não mudam; o valor do contrato soma a diferença.
 */
export default function AditivoSheet({ contract, services, currentValue, nextNumber, onClose, onSaved }: {
  contract: Contract;
  services: ServiceRow[];
  currentValue: number;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState('');
  const [data, setData] = useState(hojeEmBrasilia());
  const [edits, setEdits] = useState<Record<string, Edit>>(
    Object.fromEntries(services.map(s => [s.fvsId, { quantidade: toInput(s.previsto), preco: toInput(s.preco) }])),
  );
  const [including, setIncluding] = useState(false);
  const [drafts, setDrafts] = useState<ServiceDrafts>({});

  const rows = services.map(s => {
    const e = edits[s.fvsId];
    const qn = s.podeMudarQuantidade ? parseDecimal(e.quantidade) : s.previsto;
    const pn = e.preco.trim() ? parseDecimal(e.preco) : null;
    const qtyChanged = Number.isFinite(qn) && !same(qn, s.previsto);
    const priceChanged = !same(pn, s.preco);
    const error = !Number.isFinite(qn) || qn <= 0
      ? 'Informe a quantidade'
      : qn < s.minQuantidade - 1e-9
        ? `Mínimo ${num(s.minQuantidade)} ${s.unidade} (já aprovado em campo)`
        : pn != null && (!Number.isFinite(pn) || pn < 0)
          ? 'Preço inválido'
          : null;
    const delta = error ? 0 : qn * (pn ?? 0) - s.previsto * (s.preco ?? 0);
    return { s, e, qn, pn, changed: qtyChanged || priceChanged, qtyChanged, priceChanged, error, delta };
  });
  const inclusions = Object.entries(drafts);
  const inclusionDelta = inclusions.reduce((sum, [, d]) => sum + (draftValid(d) ? draftQuantity(d) * (draftPrice(d) ?? 0) : 0), 0);
  const delta = rows.reduce((sum, r) => sum + (r.changed ? r.delta : 0), 0) + inclusionDelta;
  const changedCount = rows.filter(r => r.changed).length + inclusions.length;
  const hasErrors = rows.some(r => r.changed && r.error) || inclusions.some(([, d]) => !draftValid(d));

  const update = (fvsId: string, patch: Partial<Edit>) => setEdits(current => ({ ...current, [fvsId]: { ...current[fvsId], ...patch } }));

  function save() {
    if (motivo.trim().length < 3) return toast('Descreva o motivo do aditivo.', 'error');
    if (!changedCount) return toast('Altere a quantidade ou o preço de um item, ou inclua um serviço.', 'error');
    if (hasErrors) return toast('Revise os itens marcados em vermelho.', 'error');
    const itens: AmendmentInput['itens'] = [
      ...rows.filter(r => r.changed).map(r => ({
        fvs_id: r.s.fvsId,
        ...(r.qtyChanged ? { quantidade: r.qn } : {}),
        ...(r.priceChanged ? { preco: r.pn } : {}),
      })),
      ...inclusions.map(([fvsId, d]) => ({
        fvs_id: fvsId,
        novo: true as const,
        metodo: d.metodo,
        unidade: d.metodo === 'unidade_concluida' ? 'un' : d.unidade.trim(),
        quantidade: draftQuantity(d),
        preco: draftPrice(d),
      })),
    ];
    startTransition(async () => {
      const result = await applyAmendment({ contratoId: contract.id, obraId: contract.obra_id, descricao: motivo.trim(), data, itens });
      if (!result.success) return toast(result.error, 'error');
      toast(`Aditivo AD-${String(nextNumber).padStart(2, '0')} registrado.`, 'success');
      onSaved();
    });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Aditivo AD-${String(nextNumber).padStart(2, '0')}`}
      size="lg"
      footer={
        <>
          <span className="mr-auto flex flex-col text-sm text-txt-2">
            <span>
              Contrato <b className="prumo-metric text-txt">{money(currentValue)}</b> → <b className="prumo-metric text-txt">{money(currentValue + delta)}</b>
            </span>
            <span className={`prumo-metric text-xs font-bold ${delta > 0 ? 'text-ok' : delta < 0 ? 'text-nok' : 'text-txt-2'}`}>
              {delta > 0 ? '+' : ''}{money(delta)} · {changedCount} {changedCount === 1 ? 'item' : 'itens'}
            </span>
          </span>
          <button type="button" onClick={onClose} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">Cancelar</button>
          <button type="button" onClick={save} disabled={pending || !changedCount} className="prumo-primary-button disabled:opacity-50">
            {pending ? 'Registrando...' : 'Registrar aditivo'}
          </button>
        </>
      }
    >
      <p className="text-sm text-txt-2">
        O aditivo vale a partir de agora e fica registrado com o seu nome. Medições já aprovadas não mudam:
        o preço novo só vale para as próximas (ou para uma medição cancelada e refeita).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Motivo
          <input value={motivo} onChange={e => setMotivo(e.target.value)} className="prumo-field py-2.5" placeholder="Ex.: acréscimo de área no 4º pavimento" />
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Data
          <input type="date" value={data} onChange={e => setData(e.target.value)} className="prumo-field py-2.5 font-mono" />
        </label>
      </div>

      <h3 className="mt-6 text-[15px] font-extrabold text-txt">Itens do contrato</h3>
      <p className="mt-1 text-[13px] text-txt-2">Mude a quantidade ou o preço. A quantidade não pode ficar abaixo do que já foi aprovado em campo.</p>
      <div className="mt-2 flex flex-col gap-2">
        {rows.map(({ s, e, changed, error, delta: rowDelta }) => (
          <div key={s.fvsId} className={`rounded-lg p-3.5 ${changed ? (error ? 'bg-nok-bg' : 'bg-accent-soft/60') : 'bg-bg-0'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm">
                <span className="text-txt-2">{s.ambiente ? `${s.ambiente} › ` : ''}</span>
                <b className="text-txt">{s.servico}</b>
              </span>
              <span className="prumo-metric text-xs text-txt-2">
                hoje {num(s.previsto)} {s.unidade} × {s.preco == null ? 'sem preço' : money(s.preco)}
              </span>
            </div>
            <div className="mt-2.5 grid items-end gap-2 sm:grid-cols-[1fr_1fr_150px]">
              <label className="flex flex-col gap-1 text-xs font-semibold text-txt-2">
                Quantidade ({s.unidade})
                <input
                  value={e.quantidade}
                  disabled={!s.podeMudarQuantidade}
                  inputMode="decimal"
                  onChange={ev => update(s.fvsId, { quantidade: ev.target.value })}
                  className="prumo-field py-2 text-right font-mono disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-txt-2">
                Preço unitário (R$)
                <input value={e.preco} inputMode="decimal" onChange={ev => update(s.fvsId, { preco: ev.target.value })} className="prumo-field py-2 text-right font-mono" placeholder="sem preço" />
              </label>
              <span className={`prumo-metric pb-2.5 text-right text-sm font-bold ${rowDelta > 0 ? 'text-ok' : rowDelta < 0 ? 'text-nok' : 'text-txt-2'}`}>
                {changed && !error ? `${rowDelta > 0 ? '+' : ''}${money(rowDelta)}` : '—'}
              </span>
            </div>
            <p className={`mt-1.5 text-xs ${error && changed ? 'font-semibold text-nok' : 'text-txt-2'}`}>
              {error && changed
                ? error
                : s.podeMudarQuantidade
                  ? `Mínimo ${num(s.minQuantidade)} ${s.unidade} (já aprovado em campo)`
                  : 'Serviço medido por unidade ou etapas: só o preço pode mudar.'}
            </p>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg bg-bg-0 p-4 text-sm text-txt-2">O contrato ainda não tem itens. Inclua serviços abaixo.</p> : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-extrabold text-txt">Incluir serviços</h3>
        {!including ? (
          <button type="button" onClick={() => setIncluding(true)} className="prumo-row-button">
            <Plus size={15} /> Incluir serviços novos
          </button>
        ) : null}
      </div>
      {including ? (
        <div className="mt-3">
          <ServicePicker obraId={contract.obra_id} drafts={drafts} onChange={setDrafts} />
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-txt-2">FVS da obra que ainda não estão em nenhum contrato.</p>
      )}
    </Modal>
  );
}
