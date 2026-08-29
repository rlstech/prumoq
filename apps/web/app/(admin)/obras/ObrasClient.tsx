'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { FilterBar, SearchField } from '@/components/ui/FilterBar';
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
  const [statusTab, setStatusTab] = useState('todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Os recortes seguem a ordem em que uma obra caminha: começa, anda, para ou termina.
  const tabs = useMemo(() => {
    const count = (status: string) => initialObras.filter(o => (o.status ?? 'em_andamento') === status).length;
    return [
      { id: 'todas', label: 'Todas', count: initialObras.length },
      { id: 'em_andamento', label: 'Em andamento', count: count('em_andamento') },
      { id: 'nao_iniciada', label: 'Não iniciadas', count: count('nao_iniciada') },
      { id: 'paralisada', label: 'Paralisadas', count: count('paralisada') },
      { id: 'concluida', label: 'Concluídas', count: count('concluida') },
    ];
  }, [initialObras]);

  const filteredObras = initialObras.filter(o => {
    if (statusTab !== 'todas' && (o.status ?? 'em_andamento') !== statusTab) return false;
    return o.nome.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
              className="prumo-row-button"
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
      <Header breadcrumbs={[{ label: 'Obras' }]} />

      <div className="prumo-page">
        <div className="prumo-page-inner">
        <PageHeader
          title="Obras"
          description="Ponto de entrada da operação: de cada obra você desce para ambientes, FVS planejadas, vistorias e medições."
          actions={
            <button type="button" onClick={() => setIsModalOpen(true)} className="prumo-primary-button">
              <Plus size={15} /> Nova obra
            </button>
          }
        >
          <Tabs tabs={tabs} value={statusTab} onChange={setStatusTab} ariaLabel="Situação das obras" />
        </PageHeader>

        <div>
          <FilterBar resultLabel={`${filteredObras.length} de ${initialObras.length} obras`}>
            <SearchField
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por nome da obra"
            />
          </FilterBar>

          <DataTable
            columns={columns}
            data={filteredObras}
            onRowClick={(item) => router.push(`/obras/${item.id}`)}
            emptyMessage="Nenhuma obra neste recorte"
            emptyHint="Ajuste a busca ou escolha outra situação acima para ver as obras cadastradas."
          />
        </div>
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
