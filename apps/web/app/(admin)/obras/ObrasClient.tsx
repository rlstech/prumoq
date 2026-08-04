'use client';

import { useState, useTransition } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import Header from '@/components/layout/Header';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import ObraModal from './ObraModal';
import { deleteObra } from './[id]/actions';

interface ObrasClientProps {
  initialObras: any[];
  empresas: any[];
  canDelete: boolean;
}

export default function ObrasClient({ initialObras, empresas, canDelete }: ObrasClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredObras = initialObras.filter(o =>
    o.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleDeleteObra() {
    if (!confirmDelete) return;
    startTransition(async () => {
      const result = await deleteObra(confirmDelete.id);
      if (result.success) {
        toast('Obra excluída com sucesso.', 'success');
        setConfirmDelete(null);
        router.refresh();
      } else {
        toast('Erro ao excluir obra: ' + (result.error ?? ''), 'error');
        setConfirmDelete(null);
      }
    });
  }

  const columns: Column<any>[] = [
    {
      header: 'Obra',
      cell: (item) => (
        <div>
          <div className="font-medium text-[13px] text-txt">{item.nome}</div>
          <div className="text-xs text-txt-2 mt-0.5">{item.endereco || item.municipio}{item.uf ? `, ${item.uf}` : ''}</div>
        </div>
      ),
      className: 'min-w-[200px]'
    },
    {
      header: 'Empresa',
      cell: (item) => <span className="text-[13px] text-txt">{item.empresa_nome || '-'}</span>,
    },
    {
      header: 'Eng. Responsável',
      cell: (item) => (
        <div>
          <div className="text-[13px] text-txt">{item.engenheiro_nome || '-'}</div>
          {item.engenheiro_crea && <div className="text-xs text-txt-2 mt-0.5">{item.engenheiro_crea}</div>}
        </div>
      ),
    },
    {
      header: 'Amb.',
      cell: (item) => <span className="text-[13px] text-txt">{item.total_ambientes || 0}</span>,
    },
    {
      header: 'FVS',
      cell: (item) => (
        <span className="text-[13px] text-txt">{item.fvs_concluidas || 0}/{item.total_fvs || 0}</span>
      ),
    },
    {
      header: 'Progresso',
      cell: (item) => {
        const percent = Math.round(item.progresso_percentual ?? (item.total_fvs > 0 ? (item.fvs_concluidas / item.total_fvs) * 100 : 0));
        return (
          <div className="w-[90px]">
            <ProgressBar value={percent} variant={percent === 100 ? 'ok' : 'brand'} />
          </div>
        );
      }
    },
    {
      header: 'Status',
      cell: (item) => <StatusBadge status={item.status || 'em_andamento'} size="sm" />
    },
    {
      header: '',
      cell: (item) => {
        const inUse = (item.total_ambientes ?? 0) > 0 || (item.total_fvs ?? 0) > 0;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/obras/${item.id}`); }}
              className="px-2.5 py-1 bg-bg-0 border border-brd-1 rounded text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors"
            >
              Abrir
            </button>
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); !inUse && setConfirmDelete({ id: item.id, name: item.nome }); }}
                disabled={inUse}
                title={inUse ? 'Obra possui registros — não pode ser excluída' : 'Excluir obra'}
                className={`p-1.5 rounded transition-colors ${inUse ? 'text-txt-3 cursor-not-allowed opacity-40' : 'text-nok hover:bg-nok/10'}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      },
      className: 'w-24'
    }
  ];

  return (
    <>
      <Header 
        breadcrumbs={[{ label: 'Obras' }]}
        actions={
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nova obra</span>
          </button>
        }
      />

      <div className="prumo-page">
        <div className="prumo-page-inner">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-txt">Obras</h2>
            <p className="text-[13px] text-txt-2">{initialObras.length} obras cadastradas</p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative w-full sm:w-56">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
              <input 
                type="text"
                placeholder="Buscar obra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-[7px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 focus:outline-none focus:border-[var(--br)]"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-[7px] rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap"
            >
              <Plus size={14} /> Nova obra
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredObras}
          onRowClick={(item) => router.push(`/obras/${item.id}`)}
          emptyMessage="Nenhuma obra encontrada com esse nome."
        />
        </div>
      </div>

      <ObraModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        empresas={empresas}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteObra}
        title="Excluir Obra"
        message={`Tem certeza que deseja excluir "${confirmDelete?.name}"? Esta ação é permanente e não pode ser desfeita.`}
        confirmText="Sim, Excluir"
        variant="danger"
        isLoading={isPending}
      />
    </>
  );
}
