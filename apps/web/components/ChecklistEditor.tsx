'use client';

import { Plus, X, GripVertical } from 'lucide-react';
import { useState } from 'react';

export interface ChecklistItemType {
  id: string; // Temporário se não salvo no banco, ou UUID se já existente
  ordem: number;
  titulo: string;
  metodo_verif: string;
  tolerancia: string;
  deleted?: boolean;
}

interface ChecklistEditorProps {
  items: ChecklistItemType[];
  onChange: (items: ChecklistItemType[]) => void;
  readOnly?: boolean;
}

export default function ChecklistEditor({ items, onChange, readOnly = false }: ChecklistEditorProps) {
  const visibleItems = items.filter(i => !i.deleted).sort((a, b) => a.ordem - b.ordem);

  const updateItem = (id: string, updates: Partial<ChecklistItemType>) => {
    onChange(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeItem = (id: string) => {
    // Se o item tem UUID longo (já do banco), marca como deleted. 
    // Se for um item novo (ex: id curto), arranca da array direto.
    if (id.length > 20) {
      onChange(items.map(i => i.id === id ? { ...i, deleted: true } : i));
    } else {
      onChange(items.filter(i => i.id !== id));
    }
  };

  const addItem = () => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      ordem: visibleItems.length + 1,
      titulo: '',
      metodo_verif: '',
      tolerancia: '',
    };
    onChange([...items, newItem]);
  };

  return (
    <div className="flex flex-col gap-3">
      {visibleItems.length === 0 ? (
        <div className="bg-bg-0 border border-brd-0 rounded-lg p-8 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-txt-2 mb-4">Nenhum item adicionado a esta FVS.</p>
          {!readOnly && (
             <button
               type="button"
               onClick={addItem}
               className="flex items-center gap-2 bg-[var(--br-light)] text-[var(--br)] border border-[var(--br)]/20 hover:bg-[var(--brl)] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
             >
               <Plus size={16} /> Adicionar Item
             </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleItems.map((item, index) => (
              <div key={item.id} className="bg-bg-1 border border-brd-0 rounded-lg overflow-hidden flex shadow-sm">
                
                {/* Drag Handle & Order */}
                <div className="bg-bg-2 w-10 flex flex-col items-center py-3 border-r border-brd-0 text-txt-3">
                  <div className="w-5 h-5 rounded-full bg-bg-1 flex items-center justify-center text-[10px] font-bold text-txt-2 mb-2 shadow-sm border border-brd-0">
                    {index + 1}
                  </div>
                  {!readOnly && <GripVertical size={16} className="opacity-50 cursor-grab" />}
                </div>

                {/* Content */}
                <div className="flex-1 p-4">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-txt-2 mb-1">O que inspecionar? (Título) *</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 focus:bg-bg-1 focus:border-[var(--br)] outline-none"
                      value={item.titulo}
                      onChange={e => updateItem(item.id, { titulo: e.target.value })}
                      placeholder="Ex: Alinhamento das paredes"
                      disabled={readOnly}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                       <label className="block text-xs font-medium text-txt-2 mb-1">Método de verificação</label>
                       <textarea 
                         className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 focus:bg-bg-1 focus:border-[var(--br)] outline-none h-[68px] resize-none"
                         value={item.metodo_verif}
                         onChange={e => updateItem(item.id, { metodo_verif: e.target.value })}
                         placeholder="Ex: Uso de prumo e nível..."
                         disabled={readOnly}
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-medium text-txt-2 mb-1">Tolerância (opcional)</label>
                       <input 
                         type="text"
                         className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 focus:bg-bg-1 focus:border-[var(--br)] outline-none"
                         value={item.tolerancia}
                         onChange={e => updateItem(item.id, { tolerancia: e.target.value })}
                         placeholder="Ex: ± 2mm"
                         disabled={readOnly}
                       />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {!readOnly && (
                  <div className="border-l border-brd-0 p-2 flex flex-col justify-start">
                    <button 
                      type="button" 
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-txt-3 hover:text-nok hover:bg-nok-bg rounded transition-colors"
                      title="Remover item"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!readOnly && (
            <button
             type="button"
             onClick={addItem}
             className="flex items-center justify-center gap-2 bg-bg-2 border border-brd-0 text-txt-2 hover:text-txt hover:bg-brd-0 py-3 rounded-lg text-sm font-medium transition-colors w-full mt-2 border-dashed"
            >
             <Plus size={16} /> Adicionar novo item
            </button>
          )}
        </>
      )}
    </div>
  );
}
