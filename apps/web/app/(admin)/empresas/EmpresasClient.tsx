'use client';

import { useState } from 'react';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Search, Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

export default function EmpresasClient({ initialData }: { initialData: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({ nome: '', cnpj: '', municipio: '', uf: '' });

  const filtered = initialData.filter(e => 
    e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.cnpj || '').includes(searchTerm)
  );

  const formatCNPJ = (val: string) => {
    return val.replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cnpjClean = formData.cnpj.replace(/\D/g, '');
    if (!cnpjClean) {
      toast('CNPJ é obrigatório.', 'error');
      return;
    }
    if (cnpjClean.length < 14) {
      toast('CNPJ deve ter 14 dígitos.', 'error');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from('empresas' as never).insert([{
      nome: formData.nome.trim(),
      cnpj: cnpjClean,
      municipio: formData.municipio.trim() || null,
      uf: formData.uf.trim() || null,
      ativo: true,
    }] as any);

    setLoading(false);
    if (!error) {
      toast('Empresa criada com sucesso!', 'success');
      setModalOpen(false);
      setFormData({ nome: '', cnpj: '', municipio: '', uf: '' });
      router.refresh();
    } else {
      const msg = error.message.includes('duplicate') 
        ? 'CNPJ já cadastrado.' 
        : error.message.includes('row-level security')
          ? 'Sem permissão. Somente administradores podem cadastrar empresas.'
          : `Erro: ${error.message}`;
      toast(msg, 'error');
      console.error('Supabase insert error:', error);
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Razão Social',
      cell: (item) => (
         <span className="font-medium text-txt">{item.nome}</span>
      ),
      className: 'w-1/3'
    },
    {
      header: 'CNPJ',
      cell: (item) => <span className="text-sm font-mono text-txt-2">{formatCNPJ(item.cnpj || '')}</span>
    },
    {
       header: 'Localização',
       cell: (item) => <span className="text-xs text-txt-3">{item.municipio ? `${item.municipio}/${item.uf}` : '-'}</span>
    },
    {
       header: 'Obras Atreladas',
       cell: (item) => (
         <span className="text-xs font-semibold px-2 py-0.5 bg-bg-2 rounded text-txt-2">
           {item.obras?.[0]?.count || 0}
         </span>
       )
    },
    {
       header: 'Status',
       cell: (item) => <StatusBadge status={item.ativo ? 'concluida' : 'cancelada'} size="sm" /> // Hack to reuse colors
    }
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-brd-0 pb-6 mb-6">
         <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
          <input 
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-brd-1 rounded-lg text-sm bg-bg-1 focus:outline-none focus:border-[var(--br)]"
          />
        </div>

        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus size={16} /> Nova Empresa
        </button>
      </div>

      <DataTable 
        columns={columns}
        data={filtered}
        emptyMessage="Nenhuma empresa encontrada."
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova Empresa" size="md">
         <form onSubmit={handleCreate} className="flex flex-col gap-4 p-2">
             <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Razão Social *</label>
              <input type="text" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-sm outline-none focus:border-[var(--br)]" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">CNPJ *</label>
              <input type="text" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-sm outline-none focus:border-[var(--br)] font-mono" value={formatCNPJ(formData.cnpj)} onChange={e => setFormData({...formData, cnpj: e.target.value})} placeholder="00.000.000/0000-00" maxLength={18} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="block text-xs font-medium text-txt-2 mb-1">Município</label>
                  <input type="text" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-sm outline-none focus:border-[var(--br)]" value={formData.municipio} onChange={e => setFormData({...formData, municipio: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-medium text-txt-2 mb-1">UF</label>
                  <input type="text" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-sm outline-none focus:border-[var(--br)] uppercase" maxLength={2} value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value.toUpperCase()})} />
               </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-brd-0 mt-2">
               <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">Cancelar</button>
               <button type="submit" disabled={loading} className="px-4 py-2 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">{loading ? 'Salvando...' : 'Salvar Empresa'}</button>
            </div>
         </form>
      </Modal>
    </>
  );
}
