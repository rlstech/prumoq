'use client';

import { useState, useTransition } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { addEquipeToObra } from './actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  obraId: string;
  availableEquipes: { id: string; nome: string; tipo: string; especialidade?: string }[];
}

export default function ObraEquipeModal({ isOpen, onClose, obraId, availableEquipes }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected(prev => (prev === id ? null : id));
  }

  function handleSave() {
    if (!selected) {
      toast('Selecione uma equipe', 'error');
      return;
    }
    startTransition(async () => {
      const result = await addEquipeToObra(obraId, selected);
      if (result.success) {
        toast('Equipe adicionada à obra!', 'success');
        router.refresh();
        setSelected(null);
        onClose();
      } else {
        toast(result.error ?? 'Erro ao adicionar equipe.', 'error');
      }
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Equipe" size="md">
      <div className="flex flex-col gap-4">
        {availableEquipes.length === 0 ? (
          <p className="text-sm text-txt-2 py-4 text-center">
            Todas as equipes já estão vinculadas a esta obra.
          </p>
        ) : (
          <div className="border border-brd-0 rounded-lg overflow-hidden">
            {availableEquipes.map(eq => {
              const isSelected = selected === eq.id;
              const isProprio = eq.tipo === 'proprio';
              return (
                <div
                  key={eq.id}
                  onClick={() => toggle(eq.id)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-brd-0 last:border-0 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--brl)]' : 'hover:bg-bg-2'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                    isSelected ? 'border-[var(--br)] bg-[var(--br)]' : 'border-brd-1'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    isProprio ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                  }`}>
                    {eq.nome.substring(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-txt leading-none">{eq.nome}</p>
                    <p className="text-xs text-txt-2 mt-0.5">{eq.especialidade || 'Geral'}</p>
                  </div>

                  {/* Tipo badge */}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    isProprio ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                  }`}>
                    {isProprio ? 'Próprio' : 'Terceirizado'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2"
          >
            Cancelar
          </button>
          {availableEquipes.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!selected || isPending}
              className="flex-1 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-50"
            >
              {isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
