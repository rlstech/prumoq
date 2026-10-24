import { useEffect, useState, useTransition } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { hojeEmBrasilia } from '@/lib/dates';
import { loadMeasurementOptions, saveMeasurementDraft, type MeasurementDraftInput, type Release, type Rework } from '../../actions';
import { money, nextDay, num } from '../../format';
import type { Contract } from '../../types';

const parseQty = (value: string) => Number(value.replace(',', '.'));

export default function NewMeasurementSheet({ contract, equipeNome, suggestedReference, lastPeriodEnd, onClose, onSaved }: {
  contract: Contract;
  equipeNome: string;
  suggestedReference: string;
  /** Fim do período da última medição: a nova começa no dia seguinte. */
  lastPeriodEnd: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [releases, setReleases] = useState<Release[]>([]);
  const [rework, setRework] = useState<Rework[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [selectedRework, setSelectedRework] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState(suggestedReference);
  const [start, setStart] = useState(() => {
    const today = hojeEmBrasilia();
    const after = lastPeriodEnd ? nextDay(lastPeriodEnd) : null;
    return after && after <= today ? after : today;
  });
  const [end, setEnd] = useState(hojeEmBrasilia());
  const [date, setDate] = useState(hojeEmBrasilia());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let alive = true;
    void loadMeasurementOptions(contract.id, contract.obra_id).then(result => {
      if (!alive) return;
      setLoading(false);
      if (!result.success) {
        toast(result.error ?? 'Falha ao carregar saldos.', 'error');
        return;
      }
      setReleases(result.releases);
      setRework(result.rework);
      // Tudo o que está liberado já vem marcado: o caso comum é medir o que a FVS aprovou.
      setSelected(new Set(result.releases.map(r => r.id)));
      setAllocations(Object.fromEntries(result.releases.map(r => [r.id, String(r.quantity)])));
    });
    return () => { alive = false; };
  }, [contract.id, contract.obra_id, toast]);

  const chosen = releases.filter(r => selected.has(r.id)).map(r => ({ ...r, quantity: parseQty(allocations[r.id] ?? String(r.quantity)) }));
  const allocationsValid = chosen.every(r => Number.isFinite(r.quantity) && r.quantity > 0 && r.quantity <= (releases.find(s => s.id === r.id)?.quantity ?? 0));
  const chosenRework = rework.filter(r => selectedRework.has(r.ncId));
  const advanceValue = chosen.reduce((sum, r) => sum + r.quantity * (r.unitPrice ?? 0), 0);
  const reworkValue = chosenRework.reduce((sum, r) => sum + r.value, 0);

  function toggle(id: string, on: boolean, quantity: number) {
    setSelected(current => {
      const next = new Set(current);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
    if (on) setAllocations(current => ({ ...current, [id]: current[id] ?? String(quantity) }));
  }

  function save() {
    if (!allocationsValid) return toast('Revise as quantidades: maiores que zero e até o liberado.', 'error');
    if (end < start) return toast('O fim do período deve ser igual ou depois do início.', 'error');
    if (date < start || date > end) return toast('A data da medição deve estar dentro do período.', 'error');
    const groups = new Map<string, typeof chosen>();
    chosen.forEach(r => groups.set(r.vinculacaoId, [...(groups.get(r.vinculacaoId) ?? []), r]));
    const itens: MeasurementDraftInput['itens'] = Array.from(groups.entries()).map(([link, list]) => {
      const quantity = list.reduce((s, r) => s + r.quantity, 0);
      const last = list[list.length - 1];
      const previous = Math.min(...list.map(r => r.previous));
      return {
        vinculacao_id: link,
        verificacao_id: last.verificacaoId,
        nc_id: null,
        tipo: 'avanco',
        quantidade_anterior: previous,
        quantidade_atual: previous + quantity,
        quantidade_periodo: quantity,
        quantidade_bloqueada: 0,
        unidade: last.unit,
        preco_unitario: last.unitPrice,
        valor_calculado: quantity * (last.unitPrice ?? 0),
        liberacoes: list.map(r => ({ avanco_id: r.id, quantidade: r.quantity })),
      };
    });
    chosenRework.forEach(cost => itens.push({
      vinculacao_id: cost.vinculacaoId, verificacao_id: null, nc_id: cost.ncId, tipo: 'retrabalho',
      quantidade_anterior: 0, quantidade_atual: 0, quantidade_periodo: 0, quantidade_bloqueada: 0,
      unidade: 'serviço', preco_unitario: null, valor_calculado: cost.value, liberacoes: [],
    }));
    startTransition(async () => {
      const result = await saveMeasurementDraft({
        contratoId: contract.id, obraId: contract.obra_id, medicaoId: null, referencia: reference,
        periodoInicio: start, periodoFim: end, dataMedicao: date, observacao: notes.trim() || null, itens,
      });
      if (!result.success) return toast(result.error, 'error');
      toast('Medição salva em rascunho. Confira e aprove.', 'success');
      onSaved(result.id);
    });
  }

  const nothing = !loading && !releases.length && !rework.length;
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nova medição"
      size="lg"
      footer={
        <>
          <span className="mr-auto text-sm text-txt-2">Total <b className="prumo-metric text-txt">{money(advanceValue + reworkValue)}</b></span>
          <button type="button" onClick={onClose} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">Cancelar</button>
          <button
            type="button"
            onClick={save}
            disabled={pending || loading || !allocationsValid || !reference.trim() || (!selected.size && !selectedRework.size)}
            className="prumo-primary-button disabled:opacity-50"
          >
            {pending ? 'Salvando...' : 'Salvar rascunho'}
          </button>
        </>
      }
    >
      <p className="text-sm text-txt-2">
        <b className="text-txt">{contract.numero}</b> · {equipeNome}. Só aparecem as quantidades aprovadas nas FVS deste contrato e ainda não medidas.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Referência
          <input value={reference} onChange={e => setReference(e.target.value)} className="prumo-field py-2.5" placeholder="BM 01" />
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Data da medição
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="prumo-field py-2.5 font-mono" />
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Período: início
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="prumo-field py-2.5 font-mono" />
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Período: fim
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="prumo-field py-2.5 font-mono" />
        </label>
      </div>

      <h3 className="mt-6 text-[15px] font-extrabold text-txt">Avanço liberado pelas FVS</h3>
      {loading ? <p className="mt-2 text-sm text-txt-2">Carregando liberações...</p> : null}
      {nothing ? (
        <p className="mt-2 rounded-lg bg-bg-0 p-4 text-sm text-txt-2">
          Nada liberado para medir agora. As quantidades aparecem aqui quando uma FVS dos serviços do contrato é aprovada.
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-2">
        {releases.map(r => {
          const checked = selected.has(r.id);
          return (
            <div key={r.id} className={`flex flex-col gap-3 rounded-lg p-3.5 sm:flex-row sm:items-center ${checked ? 'bg-accent-soft/60' : 'bg-bg-0'}`}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={checked} onChange={e => toggle(r.id, e.target.checked, r.quantity)} className="h-5 w-5 accent-[#1C1F22]" />
                <span className="min-w-0 flex-1 text-sm">
                  <b className="text-txt">{r.service}{r.stage ? ` · ${r.stage}` : ''}</b>
                  <span className="block text-[13px] text-txt-2">
                    FVS aprovou {num(r.previous)} → {num(r.current)} {r.unit} · liberado {num(r.quantity)} {r.unit}
                  </span>
                </span>
              </label>
              {checked ? (
                <label className="flex items-center gap-2 text-[13px] font-semibold text-txt-2">
                  Medir
                  <input
                    inputMode="decimal"
                    value={allocations[r.id] ?? String(r.quantity)}
                    onChange={e => setAllocations(current => ({ ...current, [r.id]: e.target.value }))}
                    className="prumo-field w-28 py-2 text-right font-mono"
                    aria-label={`Quantidade a medir de ${r.service}`}
                  />
                  {r.unit}
                </label>
              ) : null}
              <span className="prumo-metric w-28 text-right text-sm font-bold">
                {money((checked ? parseQty(allocations[r.id] ?? String(r.quantity)) || 0 : r.quantity) * (r.unitPrice ?? 0))}
              </span>
            </div>
          );
        })}
      </div>
      {!allocationsValid ? <p className="mt-2 text-sm font-semibold text-nok">A quantidade deve ser maior que zero e não pode passar do liberado.</p> : null}

      {rework.length ? (
        <>
          <h3 className="mt-6 text-[15px] font-extrabold text-txt">Retrabalho confirmado</h3>
          <p className="mt-1 text-[13px] text-txt-2">Custo separado, sem aumentar o avanço físico.</p>
          <div className="mt-2 flex flex-col gap-2">
            {rework.map(r => (
              <label key={r.ncId} className="flex cursor-pointer items-center gap-3 rounded-lg bg-warn-bg p-3.5 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#1C1F22]"
                  checked={selectedRework.has(r.ncId)}
                  onChange={e => setSelectedRework(current => { const next = new Set(current); if (e.target.checked) next.add(r.ncId); else next.delete(r.ncId); return next; })}
                />
                <span className="min-w-0 flex-1"><b>{r.service}</b><span className="block text-[13px]">{r.description}</span></span>
                <b className="prumo-metric">{money(r.value)}</b>
              </label>
            ))}
          </div>
        </>
      ) : null}

      <label className="mt-6 flex flex-col gap-2 text-[13px] font-semibold text-txt">
        Observação
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="prumo-field py-2.5" />
      </label>
    </Modal>
  );
}
