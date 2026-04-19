'use client';

import { useState } from 'react';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Search, Plus, Save } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { createEmpresa, updateEmpresa } from './actions';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const EMPTY_FORM = {
  nome: '',
  cnpj: '',
  ie: '',
  endereco: '',
  municipio: '',
  uf: '',
  cep: '',
  contato: '',
  email: '',
  telefone: '',
};

export default function EmpresasClient({ initialData }: { initialData: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const { toast } = useToast();
  const router = useRouter();

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

  const formatCEP = (val: string) => {
    return val.replace(/\D/g, '')
      .replace(/^(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
  };

  const formatPhone = (val: string) => {
    const d = val.replace(/\D/g, '');
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
  };

  const openNew = () => {
    setSelectedEmpresa(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (empresa: any) => {
    setSelectedEmpresa(empresa);
    setFormData({
      nome: empresa.nome || '',
      cnpj: empresa.cnpj || '',
      ie: empresa.ie || '',
      endereco: empresa.endereco || '',
      municipio: empresa.municipio || '',
      uf: empresa.uf || '',
      cep: empresa.cep || '',
      contato: empresa.contato || '',
      email: empresa.email || '',
      telefone: empresa.telefone || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjClean = formData.cnpj.replace(/\D/g, '');
    if (!formData.nome.trim()) { toast('Razão Social é obrigatória.', 'error'); return; }
    if (!cnpjClean || cnpjClean.length < 14) { toast('CNPJ deve ter 14 dígitos.', 'error'); return; }

    setLoading(true);
    const payload = {
      ...formData,
      cnpj: cnpjClean,
      nome: formData.nome.trim(),
      ie: formData.ie.trim() || undefined,
      endereco: formData.endereco.trim() || undefined,
      municipio: formData.municipio.trim() || undefined,
      uf: formData.uf.trim() || undefined,
      cep: formData.cep.replace(/\D/g, '').trim() || undefined,
      contato: formData.contato.trim() || undefined,
      email: formData.email.trim() || undefined,
      telefone: formData.telefone.trim() || undefined,
    };

    const result = selectedEmpresa
      ? await updateEmpresa(selectedEmpresa.id, payload)
      : await createEmpresa(payload);

    setLoading(false);
    if (result.success) {
      toast(selectedEmpresa ? 'Empresa atualizada com sucesso!' : 'Empresa criada com sucesso!', 'success');
      setModalOpen(false);
      router.refresh();
    } else {
      toast(result.error || 'Erro ao salvar.', 'error');
    }
  };

  const toggleAtivo = async (empresa: any) => {
    const novoStatus = !empresa.ativo;
    const result = await updateEmpresa(empresa.id, { ativo: novoStatus });
    if (result.success) {
      toast(novoStatus ? 'Empresa reativada!' : 'Empresa inativada.', 'success');
      router.refresh();
    } else {
      toast(result.error || 'Erro ao alterar status.', 'error');
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Razão Social',
      cell: (item) => <span className="font-medium text-txt">{item.nome}</span>,
      className: 'w-1/4'
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
      cell: (item) => <StatusBadge status={item.ativo ? 'concluida' : 'cancelada'} size="sm" />
    },
    {
      header: '',
      cell: (item) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(item)} className="px-2.5 py-1 bg-bg-0 border border-brd-1 rounded text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors">Editar</button>
          <button
            onClick={() => toggleAtivo(item)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
              item.ativo
                ? 'border-nok/30 text-nok hover:bg-nok-bg'
                : 'border-ok/30 text-ok hover:bg-ok-bg'
            }`}
          >
            {item.ativo ? 'Inativar' : 'Reativar'}
          </button>
        </div>
      )
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
          onClick={openNew}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selectedEmpresa ? 'Editar Empresa' : 'Nova Empresa'} size="lg">
        <form onSubmit={handleSave} className="flex flex-col gap-5 p-1">
          {/* Identificação */}
          <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
            <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-3">Identificação</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-txt-2 mb-1">Razão Social *</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" required value={formData.nome} onChange={e => setFormData(p => ({...p, nome: e.target.value}))} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">CNPJ *</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)] font-mono" value={formatCNPJ(formData.cnpj)} onChange={e => setFormData(p => ({...p, cnpj: e.target.value}))} placeholder="00.000.000/0000-00" maxLength={18} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">Inscrição Estadual</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formData.ie} onChange={e => setFormData(p => ({...p, ie: e.target.value}))} />
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
            <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-3">Contato</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">Pessoa de Contato</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formData.contato} onChange={e => setFormData(p => ({...p, contato: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">E-mail</label>
                <input type="email" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">Telefone</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formatPhone(formData.telefone)} onChange={e => setFormData(p => ({...p, telefone: e.target.value}))} placeholder="(61) 99999-0000" />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
            <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-3">Endereço</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-txt-2 mb-1">Endereço</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formData.endereco} onChange={e => setFormData(p => ({...p, endereco: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">Município</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formData.municipio} onChange={e => setFormData(p => ({...p, municipio: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">UF</label>
                <select className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formData.uf} onChange={e => setFormData(p => ({...p, uf: e.target.value}))}>
                  <option value="">—</option>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">CEP</label>
                <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]" value={formatCEP(formData.cep)} onChange={e => setFormData(p => ({...p, cep: e.target.value}))} placeholder="00000-000" maxLength={9} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">Cancelar</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
              <Save size={16} /> {loading ? 'Salvando...' : selectedEmpresa ? 'Salvar alterações' : 'Salvar Empresa'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}