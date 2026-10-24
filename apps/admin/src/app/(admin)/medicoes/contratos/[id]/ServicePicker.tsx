import { useEffect, useMemo, useState } from 'react';
import { SearchField } from '@/components/ui/FilterBar';
import { useToast } from '@/components/ui/Toast';
import { loadAvailableServices, type AvailableService } from '../../actions';

export type ServiceDraft = { metodo: 'quantidade' | 'unidade_concluida'; unidade: string; quantidade: string; preco: string };
export type ServiceDrafts = Record<string, ServiceDraft>;

/** Número digitado em pt-BR ("1.234,5") ou com ponto decimal. Vazio vira NaN. */
export const parseDecimal = (v: string) => (v.trim() ? Number(v.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : NaN);

export const draftQuantity = (d: ServiceDraft) => (d.metodo === 'unidade_concluida' ? 1 : parseDecimal(d.quantidade));
export const draftPrice = (d: ServiceDraft) => (d.preco.trim() ? parseDecimal(d.preco) : null);
export const draftValid = (d: ServiceDraft) => {
  const price = draftPrice(d);
  return draftQuantity(d) > 0 && (price == null || price >= 0) && Boolean(d.unidade.trim());
};

/** FVS da obra sem medição configurada, por ambiente, com método, unidade, quantidade e preço de cada marcada. */
export default function ServicePicker({ obraId, drafts, onChange }: {
  obraId: string;
  drafts: ServiceDrafts;
  onChange: (next: ServiceDrafts) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<AvailableService[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    void loadAvailableServices(obraId).then(result => {
      if (!alive) return;
      setLoading(false);
      if (!result.success) toast(result.error ?? 'Falha ao carregar serviços.', 'error');
      setServices(result.services);
    });
    return () => { alive = false; };
  }, [obraId, toast]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, AvailableService[]>();
    for (const s of services) {
      if (q && !`${s.ambiente} ${s.servico}`.toLowerCase().includes(q)) continue;
      map.set(s.ambiente, [...(map.get(s.ambiente) ?? []), s]);
    }
    return Array.from(map.entries());
  }, [services, search]);

  function toggle(id: string, on: boolean) {
    const next = { ...drafts };
    if (on) next[id] = { metodo: 'quantidade', unidade: 'm²', quantidade: '', preco: '' };
    else delete next[id];
    onChange(next);
  }
  const update = (id: string, patch: Partial<ServiceDraft>) => onChange({ ...drafts, [id]: { ...drafts[id], ...patch } });

  return (
    <div>
      <SearchField value={search} onChange={setSearch} placeholder="Buscar serviço ou ambiente" className="w-full [&_input]:bg-bg-0" />
      {loading ? <p className="mt-4 text-sm text-txt-2">Carregando serviços...</p> : null}
      {!loading && !services.length ? (
        <p className="mt-4 rounded-lg bg-bg-0 p-4 text-sm text-txt-2">Todas as FVS desta obra já estão em algum contrato, ou a obra ainda não tem FVS planejadas.</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-5">
        {groups.map(([ambiente, list]) => (
          <section key={ambiente}>
            <h4 className="mb-2 text-[13px] font-bold text-txt-2">{ambiente}</h4>
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
                          <select value={d.metodo} onChange={e => update(s.id, { metodo: e.target.value as ServiceDraft['metodo'] })} className="prumo-field py-2">
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
    </div>
  );
}
