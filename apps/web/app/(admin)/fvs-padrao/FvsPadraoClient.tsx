'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Upload, Trash2, XCircle } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import FvsImportModal from './FvsImportModal';
import { FVS_CATEGORIES, getFvsCategoryLabel } from '@/lib/fvs/categories';

export default function FvsPadraoClient({
  initialData,
  empresas,
  loadError,
}: {
  initialData: any[];
  empresas: Array<{ id: string; nome: string }>;
  loadError?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  
  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ id: string, name: string, active: boolean, inUse: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const [formData, setFormData] = useState({ nome: '', codigo: '', categoria: 'estrutura', escopo: 'global' as 'global' | 'restrito', empresaIds: [] as string[] });

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

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const supabase = createClient();
    const { error } = await (supabase.from('fvs_padrao') as any).delete().eq('id', confirmDelete.id);
    if (!error) {
      setData(prev => prev.filter(f => f.id !== confirmDelete.id));
      toast('FVS excluída com sucesso.', 'success');
    } else {
      toast('Erro ao excluir FVS: ' + (error.message || ''), 'error');
    }
    setConfirmDelete(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    
    const { data: auth } = await supabase.auth.getUser();
    const { data: userData } = await supabase.from('usuarios').select('cliente_id').eq('id', auth.user?.id ?? '').single();
    const typedUser = userData as { cliente_id: string | null } | null;
    if (!typedUser?.cliente_id) {
       toast('Sua conta não tem cliente vinculado.', 'error');
       return;
    }
    if (formData.escopo === 'restrito' && !formData.empresaIds.length) {
      toast('Selecione ao menos uma empresa.', 'error');
      return;
    }

    const payload = {
      nome: formData.nome,
      codigo: formData.codigo.trim() || null,
      categoria: formData.categoria,
      cliente_id: typedUser.cliente_id,
      escopo: formData.escopo,
      revisao_atual: -1,
      ativo: true
    };

    const { data: novafvs, error } = await supabase.from('fvs_padrao' as any).insert([payload] as any).select().single();

    if (!error && novafvs) {
      if (formData.escopo === 'restrito') {
        const { error: scopeError } = await supabase.from('fvs_padrao_empresas').insert(formData.empresaIds.map(empresa_id => ({
          cliente_id: typedUser.cliente_id!, fvs_padrao_id: (novafvs as any).id, empresa_id,
        })));
        if (scopeError) { toast('FVS criada, mas o escopo não pôde ser salvo.', 'error'); return; }
      }
      toast('FVS Padrão criada!', 'success');
      router.push(`/fvs-padrao/${(novafvs as any).id}`);
    } else {
      toast('Erro ao criar FVS: ' + (error?.message || ''), 'error');
    }
  };

  const filtered = data.filter(f => {
    if (categoriaFilter !== 'todas' && f.categoria !== categoriaFilter) return false;
    return f.nome.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const columns: Column<any>[] = [
    {
      header: 'Código',
      cell: (item) => (
        <span className="font-mono text-xs text-txt-2 whitespace-nowrap">{item.codigo || '—'}</span>
      ),
      className: 'w-24'
    },
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
    { 
      header: 'Categoria', 
      cell: (item) => <span>{getFvsCategoryLabel(item.categoria)}</span>
    },
    { 
      header: 'Itens', 
      cell: (item) => <span className="font-medium text-txt-2 text-center">{item.fvs_padrao_itens_current?.[0]?.count || 0}</span>
    },
    { 
      header: 'Rev.', 
      cell: (item) => item.revisao_atual < 0
        ? <span className="inline-flex items-center bg-bg-2 text-txt-3 px-2 py-0.5 rounded-full text-[11px] font-medium">Rascunho</span>
        : <span className="inline-flex items-center bg-pg-bg text-pg px-2 py-0.5 rounded-full text-[11px] font-medium">Rev. {item.revisao_atual}</span>
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
    },
    {
      header: '',
      cell: (item) => {
        const inUse = item.fvs_planejadas[0]?.count > 0;
        return (
          <button
            onClick={() => !inUse && setConfirmDelete({ id: item.id, name: item.nome })}
            disabled={inUse}
            title={inUse ? 'FVS em uso — não pode ser excluída' : 'Excluir FVS'}
            className={`p-1.5 rounded transition-colors ${inUse ? 'text-txt-3 cursor-not-allowed opacity-40' : 'text-nok hover:bg-nok/10'}`}
          >
            <Trash2 size={15} />
          </button>
        );
      },
      className: 'w-10'
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
            <option value="todas">Todas</option>
            {FVS_CATEGORIES.map(category => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 bg-bg-1 border border-brd-1 hover:bg-bg-2 text-txt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Upload size={16} /> Importar em Lote
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Plus size={16} /> Nova FVS Padrão
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-5 flex items-center gap-3 rounded-lg border border-nok/20 bg-nok-bg px-4 py-3 text-sm font-medium text-nok">
          <XCircle size={18} />
          <span>{loadError}</span>
        </div>
      )}

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

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir FVS Padrão"
        message={`Tem certeza que deseja excluir "${confirmDelete?.name}"? Todos os itens e histórico de revisões serão removidos permanentemente.`}
        confirmText="Sim, Excluir"
        variant="danger"
      />

      <FvsImportModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} />

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Nova FVS Padrão" size="sm">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Código</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-brd-1 rounded text-sm bg-bg-1 focus:border-[var(--br)] outline-none font-mono"
              value={formData.codigo}
              onChange={e => setFormData({ ...formData, codigo: e.target.value })}
              placeholder="Ex: FVS 03.01"
            />
          </div>
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
              {FVS_CATEGORIES.map(category => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Disponibilidade</label>
            <select className="prumo-field" value={formData.escopo} onChange={e => setFormData({...formData, escopo: e.target.value as 'global' | 'restrito', empresaIds: e.target.value === 'global' ? [] : formData.empresaIds})}>
              <option value="global">Todas as empresas</option>
              <option value="restrito">Empresas selecionadas</option>
            </select>
            {formData.escopo === 'restrito' ? <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded border border-brd-0 p-2">{empresas.map(empresa => <label key={empresa.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.empresaIds.includes(empresa.id)} onChange={e => setFormData({...formData, empresaIds: e.target.checked ? [...formData.empresaIds, empresa.id] : formData.empresaIds.filter(id => id !== empresa.id)})} />{empresa.nome}</label>)}</div> : null}
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
