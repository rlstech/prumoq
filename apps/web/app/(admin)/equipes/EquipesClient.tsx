'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { HardHat, Search, Plus } from 'lucide-react';

export default function EquipesClient({ initialEquipes }: { initialEquipes: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [equipes, setEquipes] = useState(initialEquipes);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const proprios = equipes.filter(e => e.tipo === 'Propria' && e.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  const terceirizados = equipes.filter(e => e.tipo === 'Terceirizada' && e.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  const [formData, setFormData] = useState({ nome: '', tipo: 'Propria', especialidade: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { data, error } = await supabase.from('equipes' as never).insert([{ ...formData, ativo: true }] as never).select().single();
    if (!error && data) {
      toast('Equipe criada com sucesso!', 'success');
      setEquipes(prev => [...prev, data]);
      setModalOpen(false);
      setFormData({ nome: '', tipo: 'Propria', especialidade: '' });
      router.refresh();
    } else {
      toast('Erro ao criar equipe.', 'error');
    }
  };

  const EquipeCard = ({ eq }: { eq: any }) => (
    <div className="bg-bg-1 border border-brd-0 rounded-xl p-4 flex items-center gap-4 hover:border-[var(--br)] transition-colors cursor-pointer">
       <div className="w-10 h-10 rounded-full bg-[var(--brl)] text-[var(--br)] flex items-center justify-center font-bold relative shrink-0">
         {eq.nome.substring(0, 2).toUpperCase()}
       </div>
       <div className="flex-1">
         <h4 className="font-semibold text-txt text-sm leading-tight mb-1">{eq.nome}</h4>
         <p className="text-xs text-txt-3 leading-none">{eq.especialidade || 'Geral'}</p>
       </div>
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
          onClick={() => setModalOpen(true)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova Equipe" size="sm">
         <form onSubmit={handleCreate} className="flex flex-col gap-4 p-2">
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Nome *</label>
              <input type="text" className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-sm outline-none focus:border-[var(--br)]" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Tipo *</label>
              <select className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-sm outline-none focus:border-[var(--br)]" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                <option value="Propria">Própria</option>
                <option value="Terceirizada">Terceirizada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Especialidade</label>
              <input type="text" placeholder="Ex: Carpintaria, Instalações..." className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-1 text-sm outline-none focus:border-[var(--br)]" value={formData.especialidade} onChange={e => setFormData({...formData, especialidade: e.target.value})} />
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t border-brd-0">
               <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">Cancelar</button>
               <button type="submit" className="px-4 py-2 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)]">Salvar Equipe</button>
            </div>
         </form>
      </Modal>
    </>
  );
}
