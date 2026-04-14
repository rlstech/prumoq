'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

export default function ObraModal({ isOpen, onClose, empresas }: { isOpen: boolean, onClose: () => void, empresas: any[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    empresa_id: '',
    status: 'nao_iniciada',
    municipio: '',
    uf: '',
    endereco: '',
    engenheiro_nome: '',
    engenheiro_crea: '',
    previsao_inicio: '',
    previsao_fim: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.empresa_id) {
      toast('Preencha os campos obrigatórios', 'error');
      return;
    }
    
    setLoading(true);
    const supabase = createClient();
    const payload = {
      nome: formData.nome,
      empresa_id: formData.empresa_id,
      status: formData.status,
      municipio: formData.municipio,
      uf: formData.uf,
      endereco: formData.endereco,
      eng_responsavel: formData.engenheiro_nome || 'A definir',
      crea_cau: formData.engenheiro_crea || 'A definir',
      data_inicio_prev: formData.previsao_inicio || null,
      data_termino_prev: formData.previsao_fim || null,
      ativo: true
    };

    const { error } = await supabase.from('obras' as never).insert([payload] as any);

    setLoading(false);

    if (error) {
      toast(error.message, 'error');
    } else {
      toast('Obra criada com sucesso!', 'success');
      router.refresh();
      onClose();
      setFormData({ nome: '', empresa_id: '', status: 'nao_iniciada', municipio: '', uf: '', endereco: '', engenheiro_nome: '', engenheiro_crea: '', previsao_inicio: '', previsao_fim: '' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Obra" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {/* Seção: Identificação */}
        <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
          <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-3">Identificação</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-txt-2 mb-1">Nome da Obra *</label>
              <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Residencial Portal Oeste" required autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Empresa *</label>
              <select className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.empresa_id} onChange={e => setFormData({ ...formData, empresa_id: e.target.value })} required>
                <option value="" disabled>Selecione a empresa</option>
                {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Status Inicial</label>
              <select className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                <option value="nao_iniciada">Não Iniciada</option>
                <option value="em_andamento">Em Andamento</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção: Responsável Técnico */}
        <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
          <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-3">Responsável Técnico</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Engenheiro Resp.</label>
              <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.engenheiro_nome} onChange={e => setFormData({ ...formData, engenheiro_nome: e.target.value })}
                placeholder="Ex: Eng. Roberto Matos" />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">CREA</label>
              <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.engenheiro_crea} onChange={e => setFormData({ ...formData, engenheiro_crea: e.target.value })}
                placeholder="Ex: CREA-DF 12.345-D" />
            </div>
          </div>
        </div>

        {/* Seção: Localização */}
        <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
          <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-3">Localização</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-txt-2 mb-1">Endereço</label>
              <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.endereco} onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Setor Hab. Jardins, Lote 24" />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Município</label>
              <input type="text" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.municipio} onChange={e => setFormData({ ...formData, municipio: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">UF</label>
              <input type="text" maxLength={2} className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)] uppercase"
                value={formData.uf} onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase() })} />
            </div>
          </div>
        </div>

        {/* Seção: Cronograma */}
        <div className="bg-bg-0 border border-brd-0 rounded-lg p-4">
          <div className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-3">Cronograma</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Previsão de início</label>
              <input type="date" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.previsao_inicio} onChange={e => setFormData({ ...formData, previsao_inicio: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Previsão de conclusão</label>
              <input type="date" className="w-full px-3 py-[9px] border border-brd-1 rounded text-[13px] bg-bg-1 outline-none focus:border-[var(--br)]"
                value={formData.previsao_fim} onChange={e => setFormData({ ...formData, previsao_fim: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
            {loading ? 'Salvando...' : 'Salvar Obra'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
