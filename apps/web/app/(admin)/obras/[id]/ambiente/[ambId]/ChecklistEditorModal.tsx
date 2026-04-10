'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';

interface ChecklistEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  fvsId: string;
  fvsName: string;
}

export default function ChecklistEditorModal({ isOpen, onClose, fvsId, fvsName }: ChecklistEditorModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadItems() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await (supabase.rpc as any)('get_itens_checklist', { p_fvs_id: fvsId });
      if (data) setItems(data);
      setLoading(false);
    }
    if (isOpen) loadItems();
  }, [isOpen, fvsId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Checklist: ${fvsName}`} size="lg">
      <div className="bg-warn-bg px-4 py-2.5 rounded-lg border border-warn/20 mb-5 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-warn" />
        <p className="text-xs text-warn font-medium">Nota: Esta é uma visualização dos itens de verificação (somente leitura nesta versão). A edição de itens deve ser feita na Biblioteca de FVS Padrão.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 py-4">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-bg-2 rounded-lg animate-pulse" />)}
        </div>
      ) : items.length > 0 ? (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <div key={item.id} className="border border-brd-0 rounded-lg p-3 bg-bg-1">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-bg-2 text-txt-2 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-txt leading-snug mb-1">{item.titulo}</h4>
                  {item.metodo_verif && <p className="text-xs text-txt-3 mb-1"><span className="font-semibold">Método:</span> {item.metodo_verif}</p>}
                  {item.tolerancia && <span className="inline-block px-1.5 py-0.5 rounded bg-pg-bg text-pg text-[10px] font-bold border border-pg/20">Tol: {item.tolerancia}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-txt-3">Nenhum item encontrado nesta FVS.</p>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="px-5 py-2.5 bg-bg-2 text-txt-2 hover:bg-brd-0 rounded-lg text-sm font-medium transition-colors">
          Fechar
        </button>
      </div>
    </Modal>
  );
}
