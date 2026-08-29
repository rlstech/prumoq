'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { HardHat, Plus, Save, XCircle } from 'lucide-react';
import { FilterBar, SearchField } from '@/components/ui/FilterBar';
import { createEquipe, updateEquipe } from './actions';

export default function EquipesClient({
  initialEquipes,
  empresas,
  loadError,
}: {
  initialEquipes: any[];
  empresas: Array<{ id: string; nome: string }>;
  loadError?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [equipes, setEquipes] = useState(initialEquipes);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setEquipes(initialEquipes);
  }, [initialEquipes]);

  const proprios = equipes.filter(e => e.tipo === 'proprio' && e.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  const terceirizados = equipes.filter(e => e.tipo === 'terceirizado' && e.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  const [formData, setFormData] = useState({ 
    nome: '', 
    tipo: 'proprio', 
    especialidade: '',
    responsavel: '',
    telefone: '',
    cnpj_terceiro: '',
    escopo: 'global' as 'global' | 'restrito',
    empresaIds: [] as string[],
  });

  const openNewEquipeModal = () => {
    setSelectedEquipe(null);
    setFormData({ nome: '', tipo: 'proprio', especialidade: '', responsavel: '', telefone: '', cnpj_terceiro: '', escopo: 'global', empresaIds: [] });
    setModalOpen(true);
  };

  const openEditEquipeModal = (eq: any) => {
    setSelectedEquipe(eq);
    setFormData({ 
      nome: eq.nome || '', 
      tipo: eq.tipo || 'proprio', 
      especialidade: eq.especialidade || '',
      responsavel: eq.responsavel || '',
      telefone: eq.telefone || '',
      cnpj_terceiro: eq.cnpj_terceiro || '',
      escopo: eq.escopo || 'global',
      empresaIds: (eq.equipe_empresas || []).map((item: { empresa_id: string }) => item.empresa_id),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = selectedEquipe
      ? await updateEquipe(selectedEquipe.id, formData)
      : await createEquipe(formData);

    if (result.success && result.data) {
      toast(`Equipe ${selectedEquipe ? 'atualizada' : 'criada'} com sucesso!`, 'success');
      if (selectedEquipe) {
        setEquipes(prev => prev.map(eq => eq.id === result.data.id ? result.data : eq));
      } else {
        setEquipes(prev => [...prev, result.data]);
      }
      setModalOpen(false);
      router.refresh();
    } else {
      toast(result.error ?? 'Erro ao salvar equipe.', 'error');
      console.error(result.error);
    }
    setIsLoading(false);
  };

  const EquipeCard = ({ eq }: { eq: any }) => (
    <div 
      className="bg-bg-1 border border-brd-0 rounded-xl p-4 flex items-center gap-4 hover:border-[var(--br)] transition-colors cursor-pointer group"
      onClick={() => openEditEquipeModal(eq)}
    >
       <div className="w-10 h-10 rounded-full bg-[var(--brl)] text-[var(--br)] flex items-center justify-center font-bold relative shrink-0">
         {eq.nome.substring(0, 2).toUpperCase()}
       </div>
       <div className="flex-1">
         <h4 className="font-semibold text-txt text-sm leading-tight mb-1 group-hover:text-[var(--br)] transition-colors">{eq.nome}</h4>
         <p className="text-xs text-txt-3 leading-none">{eq.especialidade || 'Especialidade Geral'}</p>
       </div>
       <div className="text-xs text-txt-2 text-right hidden sm:block">
         <div className="font-medium">{eq.responsavel || '-'}</div>
         <div className="text-txt-3">{eq.telefone || '-'}</div>
       </div>
       <button type="button" onClick={e => { e.stopPropagation(); openEditEquipeModal(eq); }} className="prumo-row-button shrink-0">
         Editar
       </button>
    </div>
  );

  return (
    <>
      <FilterBar>
        <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por equipe ou especialidade" />
        <button type="button" onClick={openNewEquipeModal} className="prumo-primary-button ml-auto">
          <Plus size={15} /> Nova equipe
        </button>
      </FilterBar>

      {loadError && (
        <div role="alert" className="mb-5 flex items-center gap-3 rounded-lg border border-nok/20 bg-nok-bg px-4 py-3 text-sm font-medium text-nok">
          <XCircle size={18} />
          <span>{loadError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
           <div className="flex items-center gap-2 mb-4">
             <div className="p-1.5 bg-bg-2 rounded text-txt-2"><HardHat size={16} /></div>
             <h3 className="text-sm font-semibold text-txt uppercase tracking-wider">Equipes Próprias</h3>
           </div>
           <div className="space-y-3">
             {proprios.length > 0 ? proprios.map(eq => <EquipeCard key={eq.id} eq={eq} />) : <p className="text-sm text-txt-3 p-4 bg-bg-0 text-center rounded-lg border border-brd-0 border-dashed">Nenhuma equipe encontrada.</p>}
           </div>
        </div>
        <div>
           <div className="flex items-center gap-2 mb-4">
             <div className="p-1.5 bg-bg-2 rounded text-txt-2"><HardHat size={16} /></div>
             <h3 className="text-sm font-semibold text-txt uppercase tracking-wider">Terceirizados</h3>
           </div>
           <div className="space-y-3">
             {terceirizados.length > 0 ? terceirizados.map(eq => <EquipeCard key={eq.id} eq={eq} />) : <p className="text-sm text-txt-3 p-4 bg-bg-0 text-center rounded-lg border border-brd-0 border-dashed">Nenhum terceirizado encontrado.</p>}
           </div>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selectedEquipe ? "Editar Equipe" : "Nova Equipe"}>
         <form onSubmit={handleSave} className="flex flex-col gap-4 p-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">Nome *</label>
                <input type="text" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-[13px] outline-none focus:border-[var(--br)]" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">Tipo *</label>
                <select className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-[13px] outline-none focus:border-[var(--br)]" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                  <option value="proprio">Própria</option>
                  <option value="terceirizado">Terceirizada</option>
                </select>
              </div>
            </div>

            {formData.tipo === 'terceirizado' && (
              <div>
                <label className="block text-xs font-medium text-txt-2 mb-1">CNPJ (Terceirizado)</label>
                <input type="text" placeholder="00.000.000/0001-00" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-[13px] outline-none focus:border-[var(--br)]" value={formData.cnpj_terceiro} onChange={e => setFormData({...formData, cnpj_terceiro: e.target.value})} />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Especialidade</label>
              <input type="text" placeholder="Ex: Carpintaria, Instalações Elétricas..." className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-[13px] outline-none focus:border-[var(--br)]" value={formData.especialidade} onChange={e => setFormData({...formData, especialidade: e.target.value})} />
            </div>

            <div className="rounded-lg border border-brd-0 bg-bg-0 p-4">
              <label className="block text-xs font-medium text-txt-2 mb-1">Disponibilidade</label>
              <select className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-[13px]" value={formData.escopo} onChange={e => setFormData({...formData, escopo: e.target.value as 'global' | 'restrito', empresaIds: e.target.value === 'global' ? [] : formData.empresaIds})}>
                <option value="global">Todas as empresas do cliente</option>
                <option value="restrito">Somente empresas selecionadas</option>
              </select>
              {formData.escopo === 'restrito' ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {empresas.map(empresa => (
                    <label key={empresa.id} className="flex items-center gap-2 text-xs text-txt">
                      <input type="checkbox" checked={formData.empresaIds.includes(empresa.id)} onChange={e => setFormData({...formData, empresaIds: e.target.checked ? [...formData.empresaIds, empresa.id] : formData.empresaIds.filter(id => id !== empresa.id)})} />
                      {empresa.nome}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-medium text-txt-2 mb-1">Responsável</label>
                  <input type="text" placeholder="Nome do contato" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-[13px] outline-none focus:border-[var(--br)]" value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-medium text-txt-2 mb-1">Telefone</label>
                  <input type="text" placeholder="(11) 90000-0000" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-[13px] outline-none focus:border-[var(--br)]" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
               </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-brd-0 mt-2">
               <button type="button" onClick={() => setModalOpen(false)} className="prumo-secondary-button">Cancelar</button>
               <button type="submit" disabled={isLoading} className="prumo-primary-button disabled:opacity-60">
                 {isLoading ? 'Salvando...' : <><Save size={16} /> Salvar Equipe</>}
               </button>
            </div>
         </form>
      </Modal>
    </>
  );
}
