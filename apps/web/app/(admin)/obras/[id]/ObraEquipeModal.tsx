'use client';

import { useState, useTransition } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addEquipeToObra } from './actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  obraId: string;
  availableEquipes: { id: string; nome: string; tipo: string; especialidade?: string }[];
  totalEmpresaEquipes: number;
}

export default function ObraEquipeModal({ isOpen, onClose, obraId, availableEquipes, totalEmpresaEquipes }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function selectAll() {
    setSelected(availableEquipes.map(e => e.id));
  }

  function clearAll() {
    setSelected([]);
  }

  function handleSave() {
    if (!selected.length) {
      toast('Selecione ao menos uma equipe', 'error');
      return;
    }
    startTransition(async () => {
      const result = await addEquipeToObra(obraId, selected);
      if (result.success) {
        const plural = selected.length > 1;
        toast(`Equipe${plural ? 's' : ''} adicionada${plural ? 's' : ''} à obra!`, 'success');
        router.refresh();
        setSelected([]);
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
          <div className="py-4 text-center space-y-2">
            {totalEmpresaEquipes === 0 ? (
              <>
                <p className="text-sm text-txt-2">Nenhuma equipe cadastrada para esta empresa.</p>
                <Link href="/equipes" className="text-xs text-[var(--br)] hover:underline font-medium">
                  Ir para Equipes →
                </Link>
              </>
            ) : (
              <p className="text-sm text-txt-2">Todas as equipes já estão vinculadas a esta obra.</p>
            )}
          </div>
        ) : (
          <div className="border border-brd-0 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-brd-0 bg-bg-2 text-[11px]">
              <span className="text-txt-2">
                {selected.length} de {availableEquipes.length} selecionada{availableEquipes.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={selected.length === availableEquipes.length}
                  className="text-[var(--br)] hover:underline font-medium disabled:opacity-40"
                >
                  Selecionar todas
                </button>
                <span className="text-brd-1">·</span>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={!selected.length}
                  className="text-txt-2 hover:underline font-medium disabled:opacity-40"
                >
                  Limpar
                </button>
              </div>
            </div>
            {availableEquipes.map(eq => {
              const isSelected = selected.includes(eq.id);
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
                  <div className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${
                    isSelected ? 'bg-[var(--br)] border-[var(--br)]' : 'border-brd-1 bg-white'
                  }`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
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
              disabled={!selected.length || isPending}
              className="flex-1 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-50"
            >
              {isPending ? 'Adicionando...' : selected.length ? `Adicionar (${selected.length})` : 'Adicionar'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
