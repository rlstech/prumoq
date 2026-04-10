'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';

export default function FvsPadraoClient({ initialData }: { initialData: any[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('Todas');
  
  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ id: string, name: string, active: boolean, inUse: number } | null>(null);

  const [formData, setFormData] = useState({ nome: '', categoria: 'Estrutura' });

  const toggleStatus = async (item: any) => {
    const inUse = item.fvs_planejadas[0]?.count || 0;
    if (item.ativo && inUse > 0) {
      setConfirmToggle({ id: item.id, name: item.nome, active: item.ativo, inUse });
      return;
    }
    
    // Toggle directly
    executeToggle(item.id, !item.ativo);
  };

  const executeToggle = async (id: string, newState: boolean) => {
    const supabase = createClient();
    const { error } = await (supabase.from('fvs_padrao') as any).update({ ativo: newState }).eq('id', id);
    if (!error) {
      setData(prev => prev.map(f => f.id === id ? { ...f, ativo: newState } : f));
      toast(newState ? 'FVS ativada com sucesso.' : 'FVS inativada com sucesso.', 'success');
    } else {
      toast('Erro ao atualizar status', 'error');
    }
    setConfirmToggle(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { data: novafvs, error } = await supabase.from('fvs_padrao' as never).insert([{
      ...formData,
      revisao_atual: 1,
      ativo: true
    }] as never).select().single();

    if (!error && novafvs) {
      toast('FVS Padrão criada!', 'success');
      router.push(`/fvs-padrao/${(novafvs as any).id}`);
    } else {
      toast('Erro ao criar FVS', 'error');
    }
  };

  const filtered = data.filter(f => {
    if (categoriaFilter !== 'Todas' && f.categoria !== categoriaFilter) return false;
    return f.nome.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const categorias = ["Estrutura", "Vedação", "Revestimento", "Instalações", "Cobertura", "Acabamento"];

  const columns: Column<any>[] = [
    {
      header: 'Nome da FVS',
      accessorKey: 'nome',
      cell: (item) => (
        <span className="font-medium text-[var(--br)] hover:underline cursor-pointer" onClick={() => router.push(`/fvs-padrao/${item.id}`)}>
          {item.nome}
        </span>
      ),
      className: 'w-1/3'
    },
    { header: 'Categoria', accessorKey: 'categoria' },
    { 
      header: 'Itens', 
      cell: (item) => <span className="font-medium text-txt-2 text-center">{item.fvs_padrao_itens[0]?.count || 0}</span> 
    },
    { 
      header: 'Rev.', 
      cell: (item) => <span className="inline-flex items-center bg-pg-bg text-pg px-2 py-0.5 rounded-full text-[11px] font-medium">Rev. {item.revisao_atual}</span> 
    },
    {
      header: 'Última alteração',
      cell: (item) => (
        <span className="text-xs text-txt-2">{item.updated_at ? new Date(item.updated_at).toLocaleDateString('pt-BR') : '-'}</span>
      )
    },
    { 
      header: 'Uso Atual', 
      cell: (item) => (
        <span className="text-xs text-txt-3">
          {item.fvs_planejadas[0]?.count > 0 ? `${item.fvs_planejadas[0].count} obras` : '0 obras'}
        </span>
      )
    },
    {
      header: 'Status',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <ToggleSwitch 
            checked={item.ativo} 
            onChange={() => toggleStatus(item)}
          />
          <span className={`text-xs font-medium ${item.ativo ? 'text-ok' : 'text-txt-3'}`}>
            {item.ativo ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      )
    }
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-brd-0 pb-6 mb-6">
        <div className="flex bg-bg-1 border border-brd-1 rounded-lg overflow-hidden w-full sm:w-auto h-[38px]">
          <div className="flex items-center px-3 border-r border-brd-1 bg-bg-0">
            <Search size={16} className="text-txt-3" />
          </div>
          <input 
            type="text"
            placeholder="Buscar FVS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 px-3 py-1.5 text-sm outline-none bg-transparent"
          />
          <select 
            value={categoriaFilter} 
            onChange={e => setCategoriaFilter(e.target.value)}
            className="border-l border-brd-1 px-3 py-1.5 text-sm bg-bg-1 outline-none font-medium text-txt-2"
          >
            <option value="Todas">Todas</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button 
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus size={16} /> Nova FVS Padrão
        </button>
      </div>

      <DataTable 
        columns={columns}
        data={filtered}
        emptyMessage="Nenhuma FVS Padrão encontrada nessa categoria."
      />

      <ConfirmDialog 
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => confirmToggle && executeToggle(confirmToggle.id, false)}
        title="Inativar FVS Padrão"
        message={`Atenção: ${confirmToggle?.inUse} ambientes em obras ativas usam esta FVS. Eles continuarão funcionando normalmente, mas a FVS não poderá ser adicionada a novos ambientes. Confirmar inativação?`}
        confirmText="Sim, Inativar"
        variant="warning"
      />

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Nova FVS Padrão" size="sm">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Nome da Verificação *</label>
            <input 
              type="text"
              className="w-full px-3 py-2 border border-brd-1 rounded text-sm bg-bg-1 focus:border-[var(--br)] outline-none"
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Execução de Alvenaria"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Categoria *</label>
            <select 
              className="w-full px-3 py-2 border border-brd-1 rounded text-sm bg-bg-1 focus:border-[var(--br)] outline-none"
              value={formData.categoria}
              onChange={e => setFormData({ ...formData, categoria: e.target.value })}
              required
            >
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="mt-4 flex gap-3">
             <button type="button" onClick={() => setCreateModalOpen(false)} className="flex-1 py-2 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">Cancelar</button>
             <button type="submit" className="flex-1 py-2 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)]">Criar e Editar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
