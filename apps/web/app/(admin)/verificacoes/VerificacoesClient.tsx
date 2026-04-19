'use client';

import { useState, useMemo, useTransition } from 'react';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import { Download, Loader2, Printer } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { getVerificacaoDetalhe } from './actions';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? 'https://pub-fd4eb9827712433599dec5fe1fef3fa5.r2.dev';

function resolveR2Url(key: string): string | null {
  if (!key) return null;
  if (key.startsWith('blob:')) return null;
  if (key.startsWith('data:') || key.startsWith('http')) return key;
  return `${R2_PUBLIC_URL}/${key}`;
}

export default function VerificacoesClient({ initialData }: { initialData: any[] }) {
  const [filters, setFilters] = useState({
    obra: 'Todas', ambiente: 'Todos', fvs: 'Todos', status: 'Todos', inspetor: 'Todos'
  });
  const [selectedVerif, setSelectedVerif] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const obras = useMemo(() => Array.from(new Set(initialData.map(v => v.fvs_planejadas?.ambientes?.obras?.nome).filter(Boolean))), [initialData]);
  const inspetores = useMemo(() => Array.from(new Set(initialData.map(v => v.usuarios?.nome).filter(Boolean))), [initialData]);

  const filtered = initialData.filter(v => {
    if (filters.obra !== 'Todas' && v.fvs_planejadas?.ambientes?.obras?.nome !== filters.obra) return false;
    if (filters.inspetor !== 'Todos' && v.usuarios?.nome !== filters.inspetor) return false;
    if (filters.status !== 'Todos') {
      if (filters.status === 'Conforme' && v.status !== 'conforme') return false;
      if (filters.status === 'Não conforme' && v.status !== 'nao_conforme') return false;
      if (filters.status === 'Em andamento' && v.status !== 'em_andamento') return false;
    }
    return true;
  });

  function openVerif(v: any) {
    setSelectedVerif(v);
    setDetailData(null);
    startTransition(async () => {
      const detail = await getVerificacaoDetalhe(v.id);
      setDetailData(detail);
    });
  }

  function closeModal() {
    setSelectedVerif(null);
    setDetailData(null);
  }

  // Resolve detail: use fetched detail when available, fall back to list row
  const detail = detailData ?? selectedVerif;

  // Build items enriched with NC descriptions
  const itens = useMemo(() => {
    if (!detailData?.verificacao_itens) return [];
    return detailData.verificacao_itens
      .slice()
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((item: any) => {
        const nc = detailData.nao_conformidades?.find((n: any) => n.verificacao_item_id === item.id);
        return { ...item, nc_descricao: nc?.descricao ?? null };
      });
  }, [detailData]);

  const fotos = useMemo(() => {
    if (!detailData?.verificacao_fotos) return [];
    return detailData.verificacao_fotos
      .slice()
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }, [detailData]);

  // Photo count from list row (verificacao_fotos: [{count: N}])
  function fotoCount(v: any): number {
    return v.verificacao_fotos?.[0]?.count ?? 0;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-txt">Verificações</h2>
          <p className="text-[13px] text-txt-2 mt-0.5">Registro completo de todas as verificações de campo</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-1 border border-brd-1 rounded-lg text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors">
            <Download size={14} /> Exportar Excel
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-1 border border-brd-1 rounded-lg text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors">
            <Printer size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-bg-1 border border-brd-0 rounded-xl p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Obra</label>
            <select className="w-full px-3 py-[9px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
              value={filters.obra} onChange={e => setFilters({...filters, obra: e.target.value})}>
              <option>Todas</option>
              {obras.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Ambiente</label>
            <select className="w-full px-3 py-[9px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
              value={filters.ambiente} onChange={e => setFilters({...filters, ambiente: e.target.value})}>
              <option>Todos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Serviço (FVS)</label>
            <select className="w-full px-3 py-[9px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
              value={filters.fvs} onChange={e => setFilters({...filters, fvs: e.target.value})}>
              <option>Todos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Status</label>
            <select className="w-full px-3 py-[9px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
              value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
              <option>Todos</option>
              <option>Conforme</option>
              <option>Não conforme</option>
              <option>Em andamento</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Inspetor</label>
            <select className="w-full px-3 py-[9px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
              value={filters.inspetor} onChange={e => setFilters({...filters, inspetor: e.target.value})}>
              <option>Todos</option>
              {inspetores.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <button className="px-4 py-[9px] bg-[var(--br)] text-white rounded-lg text-[13px] font-medium hover:bg-[var(--brd)] transition-colors">
            Filtrar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-brd-0 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-txt">Verificações registradas</h3>
          <span className="text-xs text-txt-3">Exibindo {filtered.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-0 border-b border-brd-0">
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Nº</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Serviço / FVS</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Obra / Ambiente</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">% Exec.</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Resultado</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Inspetor</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Data</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Fotos</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((v: any, idx: number) => (
                <tr key={v.id || idx} className="border-b border-brd-0 last:border-0 hover:bg-bg-0 cursor-pointer" onClick={() => openVerif(v)}>
                  <td className="py-3 px-4"><span className="font-medium text-pg text-[13px]">V-{String(v.numero_verif || idx + 1).padStart(3, '0')}</span></td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[13px] text-txt">{v.fvs_planejadas?.subservico || 'N/A'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-[13px] text-txt">{v.fvs_planejadas?.ambientes?.obras?.nome}</div>
                    <div className="text-xs text-txt-2">{v.fvs_planejadas?.ambientes?.nome}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-[60px]"><ProgressBar value={v.percentual_exec || 0} variant={v.percentual_exec >= 100 ? 'ok' : 'brand'} /></div>
                      <span className="text-xs text-txt-3">{v.percentual_exec || 0}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={v.status || 'em_andamento'} size="sm" /></td>
                  <td className="py-3 px-4 text-[13px] text-txt">{v.usuarios?.nome || '-'}</td>
                  <td className="py-3 px-4 text-[13px] text-txt">{v.data_verif ? formatDate(v.data_verif) : '-'}</td>
                  <td className="py-3 px-4">
                    {fotoCount(v) > 0 ? (
                      <span className="text-xs text-pg font-medium">📷 {fotoCount(v)}</span>
                    ) : <span className="text-xs text-txt-3">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <button className="px-2.5 py-1 bg-bg-0 border border-brd-1 rounded text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors" onClick={e => { e.stopPropagation(); openVerif(v); }}>Ver</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="py-8 text-center text-sm text-txt-3">Nenhuma verificação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalhe */}
      <Modal isOpen={!!selectedVerif} onClose={closeModal} title={`Verificação ${selectedVerif?.fvs_planejadas?.subservico || ''}`} size="xl">
        {selectedVerif && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Painel Esquerdo (3/5) */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              {/* Mini KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-bg-0 border border-brd-0 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-txt">{detail?.percentual_exec ?? 0}%</div>
                  <div className="text-[10px] text-txt-3 uppercase font-semibold">Execução</div>
                </div>
                <div className="bg-bg-0 border border-brd-0 rounded-lg p-3 flex items-center justify-center">
                  <StatusBadge status={detail?.status || 'em_andamento'} />
                </div>
                <div className="bg-bg-0 border border-brd-0 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-txt">
                    {isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : (detailData?.verificacao_itens?.length ?? '-')}
                  </div>
                  <div className="text-[10px] text-txt-3 uppercase font-semibold">Itens</div>
                </div>
              </div>

              {/* Checklist Results */}
              <div className="bg-bg-1 border border-brd-0 rounded-lg">
                <div className="px-4 py-3 border-b border-brd-0 text-xs font-bold text-txt-2 uppercase tracking-wider">Itens de verificação</div>
                {isPending ? (
                  <div className="px-4 py-6 flex justify-center"><Loader2 size={20} className="animate-spin text-txt-3" /></div>
                ) : itens.length ? itens.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-brd-0 last:border-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
                      item.resultado === 'conforme' ? 'bg-ok-bg text-ok' :
                      item.resultado === 'nao_conforme' ? 'bg-nok-bg text-nok' :
                      'bg-na-bg text-na'
                    }`}>
                      {item.resultado === 'conforme' ? '✓' : item.resultado === 'nao_conforme' ? '✕' : '—'}
                    </div>
                    <div className="flex-1">
                      <h5 className="text-[13px] font-medium text-txt">{item.titulo}</h5>
                      {item.metodo_verif && <div className="text-[11px] text-txt-3 mt-1">Método: {item.metodo_verif}</div>}
                      {item.tolerancia && <div className="text-[11px] text-txt-3">Tolerância: {item.tolerancia}</div>}
                      {item.resultado === 'nao_conforme' && item.nc_descricao && (
                        <div className="mt-2 bg-nok-bg border-l-[3px] border-nok rounded-r-md px-3 py-2">
                          <p className="text-xs text-nok leading-relaxed">{item.nc_descricao}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-xs text-txt-3">Nenhum item registrado nesta verificação.</div>
                )}
              </div>

              {/* Observações */}
              {detail?.observacoes && (
                <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-txt-2 uppercase mb-2">Observações</h4>
                  <p className="text-sm text-txt leading-relaxed">{detail.observacoes}</p>
                </div>
              )}

              {/* Assinatura */}
              {detail?.assinatura_url && (
                <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-txt-2 uppercase mb-3">Assinatura Digital</h4>
                  {resolveR2Url(detail.assinatura_url) ? (
                    <img
                      src={resolveR2Url(detail.assinatura_url)!}
                      alt="Assinatura digital"
                      className="max-h-24 w-full object-contain rounded border border-brd-0 bg-white p-2"
                    />
                  ) : (
                    <div className="flex items-center justify-center min-h-[48px] text-xs text-ok font-medium">
                      ✓ Documento assinado digitalmente
                    </div>
                  )}
                  {detail.assinada_em && (
                    <p className="text-[11px] text-txt-3 mt-2">
                      Assinado em {formatDateTime(detail.assinada_em)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Painel Direito (2/5) */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="bg-bg-0 border border-brd-0 rounded-lg p-4 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-txt-2 uppercase">Dados da verificação</h4>
                <div>
                  <div className="text-[11px] text-txt-3">Obra</div>
                  <div className="text-sm font-medium text-txt">{detail?.fvs_planejadas?.ambientes?.obras?.nome || '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-txt-3">Ambiente</div>
                  <div className="text-sm font-medium text-txt">{detail?.fvs_planejadas?.ambientes?.nome || '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-txt-3">Inspetor</div>
                  <div className="text-sm font-medium text-txt">{detail?.usuarios?.nome || '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-txt-3">Data</div>
                  <div className="text-sm font-medium text-txt">
                    {detail?.data_verif ? formatDate(detail.data_verif) : '-'}
                  </div>
                </div>
                {detail?.numero_verif && (
                  <div>
                    <div className="text-[11px] text-txt-3">Número</div>
                    <div className="text-sm font-medium text-txt">V-{String(detail.numero_verif).padStart(3, '0')}</div>
                  </div>
                )}
              </div>

              {/* Fotos */}
              <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
                <h4 className="text-xs font-bold text-txt-2 uppercase mb-3">
                  Fotos ({isPending ? '…' : fotos.length})
                </h4>
                {isPending ? (
                  <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-txt-3" /></div>
                ) : fotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {fotos.map((f: any) => {
                      const url = resolveR2Url(f.r2_key);
                      return url ? (
                        <a key={f.id} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] rounded-lg overflow-hidden border border-brd-0 hover:opacity-90 transition-opacity">
                          <img src={url} alt="Foto da verificação" className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <div key={f.id} className="aspect-[4/3] bg-bg-2 rounded-lg flex items-center justify-center text-txt-3 text-xs border border-brd-0">
                          Foto indisponível
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-txt-3 text-center py-4">Nenhuma foto registrada.</p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="mt-6 pt-4 border-t border-brd-0 flex justify-end gap-3">
          <button className="px-4 py-2 bg-bg-1 border border-brd-1 rounded-lg text-sm text-txt-2 hover:bg-bg-2 transition-colors flex items-center gap-1.5">
            <Printer size={14} /> Exportar PDF
          </button>
          <button onClick={closeModal} className="px-5 py-2 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 transition-colors">Fechar</button>
        </div>
      </Modal>
    </>
  );
}
