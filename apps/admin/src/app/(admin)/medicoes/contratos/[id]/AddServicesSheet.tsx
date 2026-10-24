import { useEffect, useMemo, useState, useTransition } from 'react';
import Modal from '@/components/ui/Modal';
import { SearchField } from '@/components/ui/FilterBar';
import { useToast } from '@/components/ui/Toast';
import { hojeEmBrasilia } from '@/lib/dates';
import { addContractServices, loadAvailableServices, type AvailableService } from '../../actions';
import { money } from '../../format';
import type { Contract } from '../../types';

type Draft = { metodo: 'quantidade' | 'unidade_concluida'; unidade: string; quantidade: string; preco: string };
const parse = (v: string) => (v.trim() ? Number(v.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : NaN);

/** Escolhe as FVS da obra que entram no contrato, com unidade, quantidade e preço. */
export default function AddServicesSheet({ contract, onClose, onSaved }: { contract: Contract; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<AvailableService[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    void loadAvailableServices(contract.obra_id).then(result => {
      if (!alive) return;
      setLoading(false);
      if (!result.success) toast(result.error ?? 'Falha ao carregar serviços.', 'error');
      setServices(result.services);
    });
    return () => { alive = false; };
  }, [contract.obra_id, toast]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, AvailableService[]>();
    for (const s of services) {
      if (q && !`${s.ambiente} ${s.servico}`.toLowerCase().includes(q)) continue;
      map.set(s.ambiente, [...(map.get(s.ambiente) ?? []), s]);
    }
    return Array.from(map.entries());
  }, [services, search]);

  const chosen = Object.entries(drafts);
  const invalid = chosen.filter(([, d]) => {
    const qty = d.metodo === 'unidade_concluida' ? 1 : parse(d.quantidade);
    const price = d.preco.trim() ? parse(d.preco) : 0;
    return !(qty > 0) || !(price >= 0) || !d.unidade.trim();
  });
  const total = chosen.reduce((sum, [, d]) => {
    const qty = d.metodo === 'unidade_concluida' ? 1 : parse(d.quantidade);
    const price = parse(d.preco);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);

  function toggle(id: string, on: boolean) {
    setDrafts(current => {
      const next = { ...current };
      if (on) next[id] = { metodo: 'quantidade', unidade: 'm²', quantidade: '', preco: '' };
      else delete next[id];
      return next;
    });
  }
  const update = (id: string, patch: Partial<Draft>) => setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));

  function save() {
    if (invalid.length) return toast('Informe unidade, quantidade maior que zero e preço válido em cada serviço marcado.', 'error');
    startTransition(async () => {
      const result = await addContractServices({
        contratoId: contract.id,
        obraId: contract.obra_id,
        dataInicio: contract.data_inicio > hojeEmBrasilia() ? contract.data_inicio : hojeEmBrasilia(),
        servicos: chosen.map(([fvsId, d]) => ({
          fvsId,
          metodo: d.metodo,
          unidade: d.metodo === 'unidade_concluida' ? 'un' : d.unidade.trim(),
          quantidade: d.metodo === 'unidade_concluida' ? 1 : parse(d.quantidade),
          preco: d.preco.trim() ? parse(d.preco) : null,
        })),
      });
      if (!result.success) {
        const first = 'error' in result && result.error ? result.error : result.failures[0]?.error;
        toast(result.added ? `${result.added} adicionados; ${result.failures.length} com erro: ${first}` : first ?? 'Falha ao adicionar.', 'error');
        if (result.added) onSaved();
        return;
      }
      toast(result.added === 1 ? 'Serviço adicionado ao contrato.' : `${result.added} serviços adicionados ao contrato.`, 'success');
      onSaved();
    });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Adicionar serviços"
      size="lg"
      footer={
        <>
          <span className="mr-auto text-sm text-txt-2">
            {chosen.length} {chosen.length === 1 ? 'serviço' : 'serviços'} · <b className="prumo-metric text-txt">{money(total)}</b>
          </span>
          <button type="button" onClick={onClose} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">Cancelar</button>
          <button type="button" onClick={save} disabled={pending || !chosen.length} className="prumo-primary-button disabled:opacity-50">
            {pending ? 'Salvando...' : 'Adicionar ao contrato'}
          </button>
        </>
      }
    >
      <p className="text-sm text-txt-2">
        Marque as FVS da obra que este contrato cobre. Serviço com etapas ponderadas: adicione aqui e ajuste em "Configurar".
      </p>
      <SearchField value={search} onChange={setSearch} placeholder="Buscar serviço ou ambiente" className="mt-4 w-full [&_input]:bg-bg-0" />
      {loading ? <p className="mt-4 text-sm text-txt-2">Carregando serviços...</p> : null}
      {!loading && !services.length ? (
        <p className="mt-4 rounded-lg bg-bg-0 p-4 text-sm text-txt-2">Todas as FVS desta obra já estão em algum contrato, ou a obra ainda não tem FVS planejadas.</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-5">
        {groups.map(([ambiente, list]) => (
          <section key={ambiente}>
            <h3 className="mb-2 text-[13px] font-bold text-txt-2">{ambiente}</h3>
            <div className="flex flex-col gap-2">
              {list.map(s => {
                const d = drafts[s.id];
                return (
                  <div key={s.id} className={`rounded-lg p-3.5 ${d ? 'bg-accent-soft/60' : 'bg-bg-0'}`}>
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-txt">
                      <input type="checkbox" checked={Boolean(d)} onChange={e => toggle(s.id, e.target.checked)} className="h-5 w-5 accent-[#1C1F22]" />
                      {s.servico}
                    </label>
                    {d ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <label className="flex flex-col gap-1 text-xs font-semibold text-txt-2">
                          Método
                          <select value={d.metodo} onChange={e => update(s.id, { metodo: e.target.value as Draft['metodo'] })} className="prumo-field py-2">
                            <option value="quantidade">Quantidade</option>
                            <option value="unidade_concluida">Unidade concluída</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-txt-2">
                          Unidade
                          <input value={d.metodo === 'unidade_concluida' ? 'un' : d.unidade} disabled={d.metodo === 'unidade_concluida'} onChange={e => update(s.id, { unidade: e.target.value })} className="prumo-field py-2 disabled:opacity-60" />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-txt-2">
                          Quantidade
                          <input value={d.metodo === 'unidade_concluida' ? '1' : d.quantidade} disabled={d.metodo === 'unidade_concluida'} inputMode="decimal" onChange={e => update(s.id, { quantidade: e.target.value })} className="prumo-field py-2 text-right font-mono disabled:opacity-60" />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-txt-2">
                          Preço unitário (R$)
                          <input value={d.preco} inputMode="decimal" onChange={e => update(s.id, { preco: e.target.value })} className="prumo-field py-2 text-right font-mono" placeholder="0,00" />
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
