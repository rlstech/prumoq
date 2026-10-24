
import Link from '@/lib/compat/link';
import { useMemo, useState } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import Tabs from '@/components/ui/Tabs';
import { FilterBar, SearchField, SelectFilter } from '@/components/ui/FilterBar';
import { ArrowRight } from '@/components/icons';

export interface NcListRecord {
  id: string;
  descricao: string;
  status: string;
  prioridade: string | null;
  data_nova_verif: string | null;
  equipes: { nome: string } | null;
  fvs_planejadas: {
    subservico: string | null;
    ambientes: {
      nome: string;
      obras: { nome: string } | null;
    } | null;
  } | null;
}

function priorityLabel(priority: string | null): string {
  if (priority === 'alta') return 'Alta';
  if (priority === 'media') return 'Média';
  if (priority === 'baixa') return 'Baixa';
  return 'Não informada';
}

function priorityDot(priority: string | null): string {
  if (priority === 'alta') return 'bg-nok';
  if (priority === 'media') return 'bg-warn';
  return 'bg-pg';
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export default function NcClient({ initialData, page, hasNextPage }: { initialData: NcListRecord[]; page: number; hasNextPage: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [obraFilter, setObraFilter] = useState('Todas');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const obras = useMemo(
    () => Array.from(new Set(
      initialData
        .map(nc => nc.fvs_planejadas?.ambientes?.obras?.nome)
        .filter((name): name is string => Boolean(name)),
    )).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [initialData],
  );

  const filtered = useMemo(() => {
    const query = normalize(searchTerm);
    return initialData.filter(nc => {
      const workName = nc.fvs_planejadas?.ambientes?.obras?.nome;
      if (obraFilter !== 'Todas' && workName !== obraFilter) return false;
      if (statusFilter === 'Abertas' && nc.status !== 'aberta') return false;
      if (statusFilter === 'Em correção' && nc.status !== 'em_correcao') return false;
      if (statusFilter === 'Resolvidas' && nc.status !== 'resolvida') return false;
      if (statusFilter === 'Canceladas' && nc.status !== 'cancelada') return false;
      if (!query) return true;
      return normalize([
        nc.descricao,
        nc.fvs_planejadas?.subservico,
        nc.fvs_planejadas?.ambientes?.nome,
        workName,
        nc.equipes?.nome,
      ].filter(Boolean).join(' ')).includes(query);
    });
  }, [initialData, obraFilter, searchTerm, statusFilter]);

  const selected = filtered.find(nc => nc.id === selectedId) ?? filtered[0] ?? null;

  function dueInfo(item: NcListRecord) {
    const dueDate = item.data_nova_verif ? new Date(`${item.data_nova_verif.slice(0, 10)}T12:00:00`) : null;
    const isClosed = item.status === 'resolvida' || item.status === 'cancelada';
    const isLate = Boolean(dueDate && dueDate < new Date() && !isClosed);
    const label = !dueDate
      ? null
      : isLate
        ? 'Vencida'
        : dueDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
    return { label, isLate, isClosed };
  }

  return (
    <>
      {/* Sem contagem nos filtros: a lista chega paginada, então um número aqui
          descreveria só a página atual — não o total do recorte. */}
      <FilterBar resultLabel={`${filtered.length} nesta página`}>
        <Tabs
          variant="chips"
          className=""
          tabs={[
            { id: 'Todas', label: 'Todas' },
            { id: 'Abertas', label: 'Abertas' },
            { id: 'Em correção', label: 'Em correção' },
            { id: 'Resolvidas', label: 'Resolvidas' },
            { id: 'Canceladas', label: 'Canceladas' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Situação das não conformidades"
        />
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar descrição, serviço ou obra"
          className="w-full sm:w-[300px]"
        />
        <SelectFilter
          label="Obra"
          value={obraFilter}
          onChange={setObraFilter}
          options={[{ value: 'Todas', label: 'Todas' }, ...obras.map(obra => ({ value: obra, label: obra }))]}
        />
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="prumo-panel overflow-x-auto px-2 py-1.5">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {['Não conformidade', 'Obra · ambiente', 'Prioridade', 'Responsável', 'Prazo', 'Situação'].map(header => (
                    <th key={header} className="prumo-th">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map(item => {
                  const workName = item.fvs_planejadas?.ambientes?.obras?.nome;
                  const due = dueInfo(item);
                  const isSelected = selected?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      aria-selected={isSelected}
                      className={`cursor-pointer border-t border-brd-0 transition-colors ${
                        isSelected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                      } ${due.isClosed ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/nc/${item.id}`}
                          onClick={event => event.stopPropagation()}
                          className="block max-w-[320px] truncate text-sm font-bold text-txt hover:underline"
                        >
                          {item.descricao || 'Ver detalhe'}
                        </Link>
                        <div className="mt-0.5 text-[13px] text-txt-2">{item.fvs_planejadas?.subservico || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-txt">{workName || '—'}</div>
                        <div className="mt-0.5 text-[13px] text-txt-2">{item.fvs_planejadas?.ambientes?.nome || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-txt">
                          <span className={`h-2 w-2 rounded-full ${priorityDot(item.prioridade)}`} aria-hidden="true" />
                          {priorityLabel(item.prioridade)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-txt">{item.equipes?.nome || '—'}</td>
                      <td className="px-4 py-3">
                        {due.label ? (
                          <span className={`prumo-pill ${due.isLate ? 'bg-nok-bg text-nok' : 'bg-warn-bg text-warn'}`}>{due.label}</span>
                        ) : <span className="text-[13px] text-txt-2">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status as 'aberta' | 'em_correcao' | 'resolvida' | 'cancelada'} tipo="nc" />
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="border-t border-brd-0 py-10 text-center text-sm text-txt-2">
                      Nenhuma NC encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} hasNextPage={hasNextPage} pathname="/nc" />
        </div>

        {selected ? (() => {
          const due = dueInfo(selected);
          const rows = [
            ['Serviço', selected.fvs_planejadas?.subservico || '—'],
            ['Responsável', selected.equipes?.nome || '—'],
            ['Prioridade', priorityLabel(selected.prioridade)],
          ];
          return (
            <aside aria-label="Resumo da NC selecionada" className="hidden flex-col gap-4 rounded-2xl bg-bg-1 p-5 xl:sticky xl:top-0 xl:flex">
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={selected.status as 'aberta' | 'em_correcao' | 'resolvida' | 'cancelada'} tipo="nc" />
                {due.label ? (
                  <span className={`prumo-pill ${due.isLate ? 'bg-nok-bg text-nok' : 'bg-warn-bg text-warn'}`}>{due.label}</span>
                ) : null}
              </div>
              <div>
                <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-txt">{selected.descricao}</h2>
                <p className="mt-1.5 text-sm text-txt-2">
                  {selected.fvs_planejadas?.ambientes?.obras?.nome || '—'} · {selected.fvs_planejadas?.ambientes?.nome || '—'}
                </p>
              </div>
              <dl className="rounded-lg bg-bg-0 px-4 py-1">
                {rows.map(([label, value], idx) => (
                  <div key={label} className={`flex justify-between gap-3 py-2.5 text-sm ${idx ? 'border-t border-brd-1/60' : ''}`}>
                    <dt className="text-txt-2">{label}</dt>
                    <dd className="text-right font-semibold text-txt">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link href={`/nc/${selected.id}`} className="prumo-primary-button w-full">
                Abrir NC <ArrowRight size={18} />
              </Link>
            </aside>
          );
        })() : null}
      </div>
    </>
  );
}
