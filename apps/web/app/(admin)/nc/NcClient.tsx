'use client';

import { useState } from 'react';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';

export default function NcClient({ initialData }: { initialData: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [obraFilter, setObraFilter] = useState('Todas');
  const [selectedNc, setSelectedNc] = useState<any>(null);

  const obras = Array.from(new Set(initialData.map(nc => nc.fvs_planejadas?.ambientes?.obras?.nome).filter(Boolean)));

  const filtered = initialData.filter(nc => {
    if (obraFilter !== 'Todas' && nc.fvs_planejadas?.ambientes?.obras?.nome !== obraFilter) return false;
    if (statusFilter !== 'Todas') {
      if (statusFilter === 'Abertas' && nc.status !== 'aberta' && nc.status !== 'em_correcao') return false;
      if (statusFilter === 'Resolvidas' && nc.status !== 'resolvida') return false;
    }
    return nc.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) || 
           nc.fvs_planejadas?.ambientes?.obras?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const columns: Column<any>[] = [
    {
      header: 'Descrição',
      cell: (item) => (
         <div className="max-w-[300px]">
           <span className="font-medium text-[13px] text-txt hover:text-[var(--br)] cursor-pointer block truncate" onClick={() => setSelectedNc(item)}>
             {item.descricao || 'Ver detalhe'}
           </span>
         </div>
      ),
      className: 'w-1/4'
    },
    {
      header: 'Serviço / Ambiente',
      cell: (item) => (
        <div>
          <div className="text-[13px] text-txt">{item.fvs_planejadas?.subservico || '-'}</div>
          <div className="text-xs text-txt-2 mt-0.5">{item.fvs_planejadas?.ambientes?.nome}</div>
        </div>
      )
    },
    {
      header: 'Obra',
      cell: (item) => <span className="text-[13px] text-txt">{item.fvs_planejadas?.ambientes?.obras?.nome || '-'}</span>
    },
    {
       header: 'Prioridade',
       cell: (item) => (
         <div className="flex items-center gap-1.5 text-xs">
           <div className={`w-2 h-2 rounded-full ${
             item.prioridade === 'Alta' ? 'bg-nok' : item.prioridade === 'Baixa' ? 'bg-pg' : 'bg-warn'
           }`} />
           {item.prioridade || 'Média'}
         </div>
       )
    },
    {
      header: 'Responsável',
      cell: (item) => <span className="text-[13px] text-txt">{item.equipes?.nome || '-'}</span>
    },
    {
       header: 'Prazo',
       cell: (item) => {
         if (!item.prazo_correcao) return <span className="text-xs text-txt-3">—</span>;
         const date = new Date(item.prazo_correcao);
         const isLate = date < new Date() && item.status !== 'resolvida' && item.status !== 'cancelada';
         return (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
              isLate ? 'bg-nok-bg text-nok' : 'bg-warn-bg text-warn'
            }`}>
              {isLate ? 'Atrasado' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
         );
       }
    },
    {
       header: 'Status',
       cell: (item) => <StatusBadge status={item.status} size="sm" />
    },
    {
      header: '',
      cell: (item) => (
        <button className="px-2.5 py-1 bg-bg-0 border border-brd-1 rounded text-xs font-medium text-txt-2 hover:bg-bg-2" onClick={() => setSelectedNc(item)}>Ver</button>
      )
    }
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex gap-3 w-full sm:w-auto items-center">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
            <input 
              type="text"
              placeholder="Buscar por descrição ou obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-[7px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 focus:outline-none focus:border-[var(--br)]"
            />
          </div>
          <select 
            value={obraFilter} 
            onChange={e => setObraFilter(e.target.value)}
            className="px-3 py-[7px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 focus:outline-none focus:border-[var(--br)]"
          >
            <option value="Todas">Todas as obras</option>
            {obras.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-[7px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 focus:outline-none focus:border-[var(--br)]"
          >
            <option value="Todas">Todos os status</option>
            <option value="Abertas">Abertas</option>
            <option value="Resolvidas">Resolvidas</option>
          </select>
        </div>
      </div>

      {/* Tabela com opacidade para resolvidas */}
      <div className="bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-brd-0">
          <h3 className="text-[14px] font-semibold text-txt">Todas as não conformidades</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-0 border-b border-brd-0">
                {columns.map((col, i) => (
                  <th key={i} className={`py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase ${col.className || ''}`}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((item: any, idx: number) => (
                <tr 
                  key={item.id || idx} 
                  className="border-b border-brd-0 last:border-0 hover:bg-bg-0"
                  style={{ opacity: item.status === 'resolvida' || item.status === 'cancelada' ? 0.55 : 1 }}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`py-3 px-4 ${col.className || ''}`}>
                      {col.cell ? col.cell(item) : (col.accessorKey ? (item as any)[col.accessorKey] : '')}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr><td colSpan={columns.length} className="py-8 text-center text-sm text-txt-3">Nenhuma NC encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!selectedNc} onClose={() => setSelectedNc(null)} title="Detalhe da NC">
         {selectedNc && (
            <div className="flex flex-col gap-4">
               <div className="flex justify-between items-start border-b border-brd-0 pb-4">
                  <div>
                    <h3 className="font-bold text-txt text-lg leading-tight mb-2">{selectedNc.fvs_planejadas?.ambientes?.obras?.nome}</h3>
                    <p className="text-sm text-txt-3">{selectedNc.fvs_planejadas?.subservico} — {selectedNc.fvs_planejadas?.ambientes?.nome}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={selectedNc.status} />
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className={`w-2 h-2 rounded-full ${selectedNc.prioridade === 'Alta' ? 'bg-nok' : selectedNc.prioridade === 'Baixa' ? 'bg-pg' : 'bg-warn'}`} />
                      {selectedNc.prioridade || 'Média'}
                    </div>
                  </div>
               </div>

               <div className="bg-bg-1 p-4 rounded-lg border border-brd-0">
                  <h4 className="text-xs font-bold text-txt-2 mb-2 uppercase">Descrição</h4>
                  <p className="text-sm font-medium text-txt bg-bg-0 p-3 rounded">{selectedNc.descricao}</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-bg-1 p-4 rounded-lg border border-brd-0">
                    <h4 className="text-xs font-bold text-txt-2 mb-2 uppercase">Equipe Designada</h4>
                    <p className="text-sm text-txt">{selectedNc.equipes?.nome || 'Nenhuma'}</p>
                 </div>
                 <div className="bg-bg-1 p-4 rounded-lg border border-brd-0">
                    <h4 className="text-xs font-bold text-txt-2 mb-2 uppercase">Prazo de Correção</h4>
                    <p className="text-sm text-txt">{selectedNc.prazo_correcao ? new Date(selectedNc.prazo_correcao).toLocaleDateString('pt-BR') : 'Não definido'}</p>
                 </div>
               </div>

               <div className="mt-4 pt-4 border-t border-brd-0 flex justify-end gap-3">
                  <button onClick={() => setSelectedNc(null)} className="px-5 py-2 bg-bg-2 text-txt border border-brd-1 rounded-lg text-sm hover:bg-brd-0 transition-colors">Fechar</button>
               </div>
            </div>
         )}
      </Modal>
    </>
  );
}
