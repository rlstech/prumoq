'use client';

import { useState } from 'react';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { CheckCircle2, Plus, Save, XCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { FilterBar, SearchField } from '@/components/ui/FilterBar';
import { createEmpresa, updateEmpresa } from './actions';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  controle_medicoes_habilitado: false,
  controle_financeiro_nc_habilitado: false,
};

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

export default function EmpresasClient({
  initialData,
  loadError,
}: {
  initialData: any[];
  loadError?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState<Feedback | null>(
    loadError ? { type: 'error', message: loadError } : null,
  );
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
      controle_medicoes_habilitado: Boolean(empresa.controle_medicoes_habilitado),
      controle_financeiro_nc_habilitado: Boolean(empresa.controle_financeiro_nc_habilitado),
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
      const message = selectedEmpresa ? 'Empresa atualizada com sucesso!' : 'Empresa criada com sucesso!';
      setFeedback({ type: 'success', message });
      toast(message, 'success');
      setModalOpen(false);
      router.refresh();
    } else {
      const message = result.error || 'Erro ao salvar.';
      setFeedback({ type: 'error', message });
      toast(message, 'error');
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
        <div className="flex gap-1.5">
          <Link href={`/empresas/${item.id}/modelos-medicao`} className="prumo-row-button">Modelos</Link>
          <button type="button" onClick={() => openEdit(item)} className="prumo-row-button">Editar</button>
          <button
            type="button"
            onClick={() => toggleAtivo(item)}
            className={`inline-flex h-7 items-center rounded border px-2.5 text-xs font-semibold transition-colors ${
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
      <FilterBar resultLabel={`${filtered.length} de ${initialData.length} empresas`}>
        <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por razão social ou CNPJ" />
        <button type="button" onClick={openNew} className="prumo-primary-button ml-auto">
          <Plus size={15} /> Nova empresa
        </button>
      </FilterBar>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mb-5 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-ok/20 bg-ok-bg text-ok'
              : 'border-nok/20 bg-nok-bg text-nok'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span className="flex-1">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded px-2 py-1 text-xs hover:bg-black/5"
            aria-label="Fechar mensagem"
          >
            Fechar
          </button>
        </div>
      )}

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

          <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
            <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-1">Recursos opcionais</div>
            <p className="mb-3 text-xs leading-5 text-txt-3">Defina o padrão para as obras desta empresa. Cada obra pode herdar ou sobrescrever estes controles.</p>
            <label className="flex items-start gap-3 rounded-lg border border-brd-1 bg-bg-1 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.controle_medicoes_habilitado}
                onChange={e => setFormData(p => ({ ...p, controle_medicoes_habilitado: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[var(--br)]"
              />
              <span>
                <span className="block text-sm font-medium text-txt">Controle de medições</span>
                <span className="block mt-0.5 text-xs text-txt-3">Libera avanço aprovado, vínculos de execução e boletins de medição nas obras habilitadas.</span>
              </span>
            </label>
            <label className="mt-2 flex items-start gap-3 rounded-lg border border-brd-1 bg-bg-1 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.controle_financeiro_nc_habilitado}
                onChange={e => setFormData(p => ({ ...p, controle_financeiro_nc_habilitado: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[var(--br)]"
              />
              <span>
                <span className="block text-sm font-medium text-txt">Impacto financeiro de não conformidades</span>
                <span className="block mt-0.5 text-xs text-txt-3">Exige situação financeira e decisão de bloqueio de medição para novas NCs.</span>
              </span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="prumo-secondary-button">Cancelar</button>
            <button type="submit" disabled={loading} className="prumo-primary-button disabled:opacity-60">
              <Save size={16} /> {loading ? 'Salvando...' : selectedEmpresa ? 'Salvar alterações' : 'Salvar Empresa'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
