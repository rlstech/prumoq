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
import { Download, Loader2, Printer } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import DataTable, { Column } from '@/components/ui/DataTable';
import { FilterBar, SelectFilter } from '@/components/ui/FilterBar';
import { getVerificacaoDetalhe } from './actions';
import Pagination from '@/components/ui/Pagination';

function resolveR2Url(key: string): string | null {
  if (!key) return null;
  if (key.startsWith('blob:')) return null;
  if (key.startsWith('data:') || key.startsWith('http')) return key;
  return null;
}

export default function VerificacoesClient({ initialData, page, hasNextPage }: { initialData: any[]; page: number; hasNextPage: boolean }) {
  const [filters, setFilters] = useState({
    obra: 'Todas', ambiente: 'Todos', fvs: 'Todos', status: 'Todos', inspetor: 'Todos'
  });
  const [selectedVerif, setSelectedVerif] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const obras = useMemo(() => Array.from(new Set(initialData.map(v => v.fvs_planejadas?.ambientes?.obras?.nome).filter(Boolean))), [initialData]);
  const ambientes = useMemo(() => Array.from(new Set(initialData.map(v => v.fvs_planejadas?.ambientes?.nome).filter(Boolean))), [initialData]);
  const servicos = useMemo(() => Array.from(new Set(initialData.map(v => v.fvs_planejadas?.subservico).filter(Boolean))), [initialData]);
  const inspetores = useMemo(() => Array.from(new Set(initialData.map(v => v.usuarios?.nome).filter(Boolean))), [initialData]);

  const filtered = initialData.filter(v => {
    if (filters.obra !== 'Todas' && v.fvs_planejadas?.ambientes?.obras?.nome !== filters.obra) return false;
    if (filters.ambiente !== 'Todos' && v.fvs_planejadas?.ambientes?.nome !== filters.ambiente) return false;
    if (filters.fvs !== 'Todos' && v.fvs_planejadas?.subservico !== filters.fvs) return false;
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

  const columns: Column<any>[] = [
    {
      header: 'Nº',
      cell: (v) => <span className="text-[13px] font-medium text-pg">V-{String(v.numero_verif || filtered.indexOf(v) + 1).padStart(3, '0')}</span>,
    },
    {
      header: 'Serviço / FVS',
      cell: (v) => <span className="text-[13px] font-medium text-txt">{v.fvs_planejadas?.subservico || 'N/A'}</span>,
    },
    {
      header: 'Obra / Ambiente',
      cell: (v) => (
        <div>
          <div className="text-[13px] text-txt">{v.fvs_planejadas?.ambientes?.obras?.nome}</div>
          <div className="text-xs text-txt-2">{v.fvs_planejadas?.ambientes?.nome}</div>
        </div>
      ),
    },
    { header: 'Resultado', cell: (v) => <StatusBadge status={v.status || 'em_andamento'} size="sm" /> },
    { header: 'Inspetor', cell: (v) => <span className="text-[13px] text-txt">{v.usuarios?.nome || '-'}</span> },
    { header: 'Data', cell: (v) => <span className="text-[13px] text-txt">{v.data_verif ? formatDate(v.data_verif) : '-'}</span> },
    {
      header: 'Fotos',
      cell: (v) => fotoCount(v) > 0 ? (
        <span className="text-xs font-medium text-pg">{fotoCount(v)} foto{fotoCount(v) > 1 ? 's' : ''}</span>
      ) : <span className="text-xs text-txt-3">—</span>,
    },
    {
      header: '',
      align: 'right',
      cell: (v) => (
        <button type="button" className="prumo-row-button" onClick={e => { e.stopPropagation(); openVerif(v); }}>Ver</button>
      ),
    },
  ];

  return (
    <>
      <FilterBar resultLabel={`${filtered.length} de ${initialData.length} vistorias`}>
        <SelectFilter label="Obra:" value={filters.obra} onChange={value => setFilters({ ...filters, obra: value })}
          options={[{ value: 'Todas', label: 'Todas' }, ...obras.map(o => ({ value: o, label: o }))]} />
        <SelectFilter label="Ambiente:" value={filters.ambiente} onChange={value => setFilters({ ...filters, ambiente: value })}
          options={[{ value: 'Todos', label: 'Todos' }, ...ambientes.map(a => ({ value: a, label: a }))]} />
        <SelectFilter label="Serviço:" value={filters.fvs} onChange={value => setFilters({ ...filters, fvs: value })}
          options={[{ value: 'Todos', label: 'Todos' }, ...servicos.map(s => ({ value: s, label: s }))]} />
        <SelectFilter label="Status:" value={filters.status} onChange={value => setFilters({ ...filters, status: value })}
          options={[
            { value: 'Todos', label: 'Todos' },
            { value: 'Conforme', label: 'Conforme' },
            { value: 'Não conforme', label: 'Não conforme' },
            { value: 'Em andamento', label: 'Em andamento' },
          ]} />
        <SelectFilter label="Inspetor:" value={filters.inspetor} onChange={value => setFilters({ ...filters, inspetor: value })}
          options={[{ value: 'Todos', label: 'Todos' }, ...inspetores.map(i => ({ value: i, label: i }))]} />
        <div className="ml-auto flex gap-2">
          <button type="button" className="prumo-secondary-button">
            <Download size={15} /> Exportar Excel
          </button>
          <button type="button" className="prumo-secondary-button">
            <Printer size={15} /> PDF
          </button>
        </div>
      </FilterBar>

      <DataTable
        data={filtered}
        columns={columns}
        onRowClick={openVerif}
        rowKey={(v) => String(v.id)}
        emptyMessage="Nenhuma vistoria neste recorte"
        emptyHint="Ajuste os filtros acima para ver as vistorias registradas."
      />
      <Pagination page={page} hasNextPage={hasNextPage} pathname="/verificacoes" />

      {/* Modal Detalhe */}
      <Modal isOpen={!!selectedVerif} onClose={closeModal} title={`Verificação ${selectedVerif?.fvs_planejadas?.subservico || ''}`} size="xl">
        {selectedVerif && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Painel Esquerdo (3/5) */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              {/* Mini KPIs */}
              <div className="grid grid-cols-2 gap-3">
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
          <button type="button" className="prumo-secondary-button">
            <Printer size={15} /> Exportar PDF
          </button>
          <button type="button" onClick={closeModal} className="prumo-secondary-button">Fechar</button>
        </div>
      </Modal>
    </>
  );
}
