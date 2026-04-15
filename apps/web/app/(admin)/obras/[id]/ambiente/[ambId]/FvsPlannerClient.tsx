'use client';

import { useState } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import ChecklistEditorModal from './ChecklistEditorModal';
import AddFvsModal from './AddFvsModal';

interface FvsPlannerClientProps {
  ambiente: any;
  initialFvsList: any[];
  fvsPadraoList: any[];
}

export default function FvsPlannerClient({ ambiente, initialFvsList, fvsPadraoList }: FvsPlannerClientProps) {
  const [selectedFvsId, setSelectedFvsId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const concluidasCount = initialFvsList.filter(f => f.status === 'conforme').length;
  const progress = initialFvsList.length > 0 ? Math.round((concluidasCount / initialFvsList.length) * 100) : 0;

  const alreadyLinkedIds = initialFvsList.map(f => f.fvs_padrao_id);

  return (
    <div className="flex flex-col lg:flex-row h-full max-w-[1400px] mx-auto p-6 gap-6">
      
      {/* Left Panel: FVS Planejadas */}
      <div className="flex-1 flex flex-col bg-bg-1 border border-brd-0 rounded-xl overflow-hidden min-h-[500px]">
        <div className="px-5 py-4 border-b border-brd-0 bg-bg-0 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-txt tracking-tight">FVS Planejadas</h2>
            <p className="text-xs text-txt-2">{initialFvsList.length} serviços • {concluidasCount} concluídos</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 bg-[var(--br)] text-white rounded-lg text-xs font-medium hover:bg-[var(--brd)] transition-colors"
          >
            + Adicionar
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {initialFvsList.length > 0 ? (
           <table className="w-full text-left">
             <tbody>
               {initialFvsList.map((fvs) => (
                 <tr key={fvs.id} className="border-b border-brd-0 last:border-0 hover:bg-bg-2">
                   <td className="py-3 px-5">
                     <div className="flex items-center gap-3">
                       <div className={`w-2.5 h-2.5 rounded-full ${fvs.status === 'conforme' ? 'bg-ok' : fvs.status === 'nao_conforme' ? 'bg-nok' : 'bg-[var(--br)]'}`} />
                       <div>
                         <h3 className="font-medium text-sm text-txt">{fvs.subservico}</h3>
                         <p className="text-[11px] text-txt-3">Última verif: {fvs.ultima_verif ? new Date(fvs.ultima_verif).toLocaleDateString('pt-BR') : 'Nenhuma'}</p>
                       </div>
                     </div>
                   </td>
                   <td className="py-3 px-5">
                     <StatusBadge status={fvs.status} size="sm" />
                   </td>
                   <td className="py-3 px-5 text-right">
                     <button 
                       onClick={() => setSelectedFvsId(fvs.id)}
                       className="text-xs font-semibold text-[var(--br)] hover:text-[var(--brd)]"
                     >
                       Ver Checklist
                     </button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
          ) : (
            <div className="p-12 text-center text-sm text-txt-3 flex flex-col items-center justify-center h-full gap-3">
              <p>Nenhuma FVS vinculada a este ambiente.</p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="text-xs font-semibold text-[var(--br)] underline"
              >
                Vincular primeira FVS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Resumo Info */}
      <div className="w-full lg:w-[340px] flex flex-col gap-6 shrink-0">
        <div className="bg-bg-1 border border-brd-0 rounded-xl p-5">
          <h3 className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-4">Progresso do Ambiente</h3>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-semibold text-txt leading-none">{progress}%</span>
            <span className="text-sm font-medium text-txt-3 mb-1">concluído</span>
          </div>
          <ProgressBar value={progress} variant={progress === 100 ? 'ok' : 'brand'} />
          
          <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-brd-0">
            <div>
              <p className="text-[11px] text-txt-3 uppercase font-semibold mb-1">Concluídas</p>
              <p className="text-lg font-medium text-txt">{concluidasCount}</p>
            </div>
            <div>
              <p className="text-[11px] text-txt-3 uppercase font-semibold mb-1">Pendentes</p>
              <p className="text-lg font-medium text-txt">{initialFvsList.length - concluidasCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-bg-1 border border-brd-0 rounded-xl p-5">
           <h3 className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-4">Detalhes</h3>
           <dl className="space-y-3 text-sm">
             <div>
               <dt className="text-txt-3 text-xs mb-0.5">Tipo</dt>
               <dd className="font-medium text-txt">{ambiente.tipo}</dd>
             </div>
             <div>
               <dt className="text-txt-3 text-xs mb-0.5">Localização</dt>
               <dd className="font-medium text-txt">{ambiente.localizacao}</dd>
             </div>
             {ambiente.observacoes && (
               <div>
                 <dt className="text-txt-3 text-xs mb-0.5">Observações</dt>
                 <dd className="text-txt line-clamp-3 leading-relaxed">{ambiente.observacoes}</dd>
               </div>
             )}
           </dl>
        </div>
      </div>

      {selectedFvsId && (
        <ChecklistEditorModal 
          isOpen={true} 
          onClose={() => setSelectedFvsId(null)} 
          fvsId={selectedFvsId} 
          fvsName={initialFvsList.find(f => f.id === selectedFvsId)?.subservico || ''}
        />
      )}

      {isAddModalOpen && (
        <AddFvsModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          obraId={ambiente.obra_id}
          ambId={ambiente.id}
          fvsPadraoList={fvsPadraoList}
          alreadyLinkedIds={alreadyLinkedIds}
        />
      )}
    </div>
  );
}
