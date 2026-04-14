'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { HardHat, Search, Plus, Save } from 'lucide-react';
import { createEquipe, updateEquipe } from './actions';

export default function EquipesClient({ initialEquipes }: { initialEquipes: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [equipes, setEquipes] = useState(initialEquipes);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const proprios = equipes.filter(e => e.tipo === 'proprio' && e.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  const terceirizados = equipes.filter(e => e.tipo === 'terceirizado' && e.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  const [formData, setFormData] = useState({ 
    nome: '', 
    tipo: 'proprio', 
    especialidade: '',
    responsavel: '',
    telefone: '',
    cnpj_terceiro: ''
  });

  const openNewEquipeModal = () => {
    setSelectedEquipe(null);
    setFormData({ nome: '', tipo: 'proprio', especialidade: '', responsavel: '', telefone: '', cnpj_terceiro: '' });
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
      cnpj_terceiro: eq.cnpj_terceiro || ''
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
       <button className="px-3 py-1.5 bg-bg-2 hover:bg-brd-0 rounded-lg text-xs font-medium text-txt-2 transition-colors shrink-0">
         Editar
       </button>
    </div>
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-brd-0 pb-6 mb-6">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
          <input 
            type="text"
            placeholder="Buscar equipe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-brd-1 rounded-lg text-sm bg-bg-1 focus:outline-none focus:border-[var(--br)]"
          />
        </div>

        <button 
          onClick={openNewEquipeModal}
          className="flex items-center gap-2 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus size={16} /> Nova Equipe
        </button>
      </div>

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
               <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">Cancelar</button>
               <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
                 {isLoading ? 'Salvando...' : <><Save size={16} /> Salvar Equipe</>}
               </button>
            </div>
         </form>
      </Modal>
    </>
  );
}
