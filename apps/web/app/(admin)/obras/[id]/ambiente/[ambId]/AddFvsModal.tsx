'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { addFvsToAmbiente } from '../../actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  obraId: string;
  ambId: string;
  fvsPadraoList: any[];
  alreadyLinkedIds: string[];
}

export default function AddFvsModal({
  isOpen,
  onClose,
  obraId,
  ambId,
  fvsPadraoList,
  alreadyLinkedIds,
}: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const available = fvsPadraoList.filter(f => !alreadyLinkedIds.includes(f.id));

  const toggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      toast('Selecione pelo menos uma FVS', 'error');
      return;
    }

    setLoading(true);
    const result = await addFvsToAmbiente(obraId, ambId, selectedIds, fvsPadraoList);
    setLoading(false);

    if (result.success) {
      toast('FVS adicinadas com sucesso!', 'success');
      router.refresh();
      onClose();
    } else {
      toast(result.error ?? 'Erro ao adicionar FVS.', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar FVS ao Ambiente" size="md">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-txt-3">
          Selecione as fixas de verificação padrão que deseja adicionar a este ambiente.
        </p>

        <div className="border border-brd-0 rounded-lg overflow-hidden bg-bg-0 max-h-80 overflow-y-auto">
          {available.length > 0 ? (
            available.map(fvs => {
              const isSelected = selectedIds.includes(fvs.id);
              return (
                <div
                  key={fvs.id}
                  onClick={() => toggle(fvs.id)}
                  className={`flex items-start gap-3 p-3 border-b border-brd-0 last:border-0 cursor-pointer hover:bg-bg-2 transition-colors ${
                    isSelected ? 'bg-[var(--brl)]' : ''
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      isSelected ? 'bg-[var(--br)] border-[var(--br)]' : 'border-brd-1 bg-white'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-txt leading-none">{fvs.nome}</h4>
                    <p className="text-[11px] text-txt-3 mt-1">
                      {fvs.categoria} • Rev. {fvs.revisao_atual}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="p-8 text-center text-xs text-txt-3">
              Todas as FVS disponíveis já estão vinculadas.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || selectedIds.length === 0}
            className="flex-1 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-50"
          >
            {loading ? 'Adicionando...' : 'Adicionar selecionadas'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
