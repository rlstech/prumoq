'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { createAmbiente } from './actions';

export default function AmbienteModal({ isOpen, onClose, obraId, fvsPadraoList }: { isOpen: boolean, onClose: () => void, obraId: string, fvsPadraoList: any[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'interno',
    localizacao: '',
    observacoes: '',
  });

  const [selectedFvs, setSelectedFvs] = useState<string[]>([]);

  const toggleFvs = (id: string) => {
    setSelectedFvs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.localizacao) {
      toast('Preencha os campos obrigatórios', 'error');
      return;
    }

    setLoading(true);
    const result = await createAmbiente(obraId, formData, selectedFvs, fvsPadraoList);
    setLoading(false);

    if (result.success) {
      toast('Ambiente cadastrado com sucesso!', 'success');
      router.refresh();
      onClose();
    } else {
      toast(result.error ?? 'Erro ao salvar ambiente.', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Ambiente" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6">
        
        {/* Lado esquerdo: Dados do ambiente */}
        <div className="flex-1 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-1">Dados Básicos</h3>
          
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Nome do Ambiente *</label>
            <input 
              type="text"
              className="w-full px-3 py-2 border border-brd-1 rounded text-sm bg-bg-1"
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Apartamento 302"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Tipo *</label>
              <select 
                className="w-full px-3 py-2 border border-brd-1 rounded text-sm bg-bg-1"
                value={formData.tipo}
                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
              >
                <option value="interno">Interno</option>
                <option value="externo">Externo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Localização *</label>
              <input 
                type="text"
                className="w-full px-3 py-2 border border-brd-1 rounded text-sm bg-bg-1"
                value={formData.localizacao}
                onChange={e => setFormData({ ...formData, localizacao: e.target.value })}
                placeholder="Ex: Torre B"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1">Observações</label>
            <textarea 
              className="w-full px-3 py-2 border border-brd-1 rounded text-sm bg-bg-1 h-20 resize-none"
              value={formData.observacoes}
              onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
            />
          </div>
        </div>

        {/* Lado Direito: Seleção FVS */}
        <div className="flex-1 flex flex-col pt-4 md:pt-0 md:border-l md:border-brd-0 md:pl-6">
          <h3 className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-2">FVS Planejadas (Checklists)</h3>
          <p className="text-[11px] text-txt-3 mb-4">Selecione as fixas de verificação padrão que se aplicam a este ambiente.</p>
          
          <div className="flex-1 overflow-y-auto max-h-64 border border-brd-0 rounded-lg overflow-hidden bg-bg-0">
            {fvsPadraoList.map(fvs => {
              const isSelected = selectedFvs.includes(fvs.id);
              return (
                <div 
                  key={fvs.id}
                  onClick={() => toggleFvs(fvs.id)}
                  className={`flex items-start gap-3 p-3 border-b border-brd-0 last:border-0 cursor-pointer hover:bg-bg-2 transition-colors ${isSelected ? 'bg-[var(--brl)]' : ''}`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${isSelected ? 'bg-[var(--br)] border-[var(--br)]' : 'border-brd-1 bg-white'}`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-txt leading-none">{fvs.nome}</h4>
                    <p className="text-[11px] text-txt-3 mt-1">{fvs.categoria} • Rev. {fvs.revisao_atual}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </form>
      
      {/* Footer out of form to bypass flex alignment issues */}
      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-brd-0">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0">
          Cancelar
        </button>
        <button type="button" onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
          {loading ? 'Salvando...' : 'Salvar Ambiente'}
        </button>
      </div>
    </Modal>
  );
}
