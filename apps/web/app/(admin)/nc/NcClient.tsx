'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';

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
      if (statusFilter === 'Abertas' && !['aberta', 'em_correcao'].includes(nc.status)) return false;
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

  return (
    <>
      <div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative min-w-[220px] flex-1 sm:w-72 sm:flex-initial">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
            <input
              type="search"
              placeholder="Buscar descrição, serviço ou obra"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-brd-1 bg-bg-1 py-[7px] pl-9 pr-4 text-[13px] focus:border-[var(--br)] focus:outline-none"
            />
          </div>
          <select
            value={obraFilter}
            onChange={event => setObraFilter(event.target.value)}
            className="rounded-lg border border-brd-1 bg-bg-1 px-3 py-[7px] text-[13px] focus:border-[var(--br)] focus:outline-none"
          >
            <option value="Todas">Todas as obras</option>
            {obras.map(obra => <option key={obra} value={obra}>{obra}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className="rounded-lg border border-brd-1 bg-bg-1 px-3 py-[7px] text-[13px] focus:border-[var(--br)] focus:outline-none"
          >
            <option value="Todas">Todos os status</option>
            <option value="Abertas">Abertas</option>
            <option value="Resolvidas">Resolvidas</option>
            <option value="Canceladas">Canceladas</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-brd-0 bg-bg-1">
        <div className="flex items-center justify-between border-b border-brd-0 px-5 py-3">
          <h3 className="text-[14px] font-semibold text-txt">Todas as não conformidades</h3>
          <span className="font-mono text-xs text-txt-3">{filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-brd-0 bg-bg-0">
                {['Descrição', 'Serviço / Ambiente', 'Obra', 'Prioridade', 'Responsável', 'Prazo', 'Status', ''].map(header => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2 first:w-1/4"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(item => {
                const workName = item.fvs_planejadas?.ambientes?.obras?.nome;
                const dueDate = item.data_nova_verif ? new Date(`${item.data_nova_verif.slice(0, 10)}T12:00:00`) : null;
                const isClosed = item.status === 'resolvida' || item.status === 'cancelada';
                const isLate = Boolean(dueDate && dueDate < new Date() && !isClosed);
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-brd-0 last:border-0 hover:bg-bg-0 ${isClosed ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/nc/${item.id}`}
                        className="block max-w-[320px] truncate text-[13px] font-medium text-txt hover:text-[var(--br)]"
                      >
                        {item.descricao || 'Ver detalhe'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] text-txt">{item.fvs_planejadas?.subservico || '—'}</div>
                      <div className="mt-0.5 text-xs text-txt-2">{item.fvs_planejadas?.ambientes?.nome || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-txt">{workName || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-txt">
                        <span className={`h-2 w-2 rounded-full ${priorityDot(item.prioridade)}`} />
                        {priorityLabel(item.prioridade)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-txt">{item.equipes?.nome || '—'}</td>
                    <td className="px-4 py-3">
                      {dueDate ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          isLate ? 'bg-nok-bg text-nok' : 'bg-warn-bg text-warn'
                        }`}>
                          {isLate
                            ? 'Vencida'
                            : dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      ) : <span className="text-xs text-txt-3">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status as 'aberta' | 'em_correcao' | 'resolvida' | 'cancelada'} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/nc/${item.id}`}
                        aria-label={`Ver detalhes da não conformidade: ${item.descricao}`}
                        className="inline-flex rounded border border-brd-1 bg-bg-0 px-2.5 py-1 text-xs font-medium text-txt-2 transition-colors hover:bg-bg-2 hover:text-txt"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-txt-3">
                    Nenhuma NC encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} hasNextPage={hasNextPage} pathname="/nc" />
    </>
  );
}
