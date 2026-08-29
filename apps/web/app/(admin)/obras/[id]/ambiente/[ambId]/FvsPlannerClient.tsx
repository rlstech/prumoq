'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, FileText, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import ChecklistEditorModal from './ChecklistEditorModal';
import AddFvsModal from './AddFvsModal';
import { deleteFvsPlanejada } from '../../actions';

interface FvsPlannerClientProps {
  ambiente: any;
  initialFvsList: any[];
  fvsPadraoList: any[];
  measurementEnabled: boolean;
}

export default function FvsPlannerClient({ ambiente, initialFvsList, fvsPadraoList, measurementEnabled }: FvsPlannerClientProps) {
  const [selectedFvsId, setSelectedFvsId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fvsToDelete, setFvsToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const concluidasCount = initialFvsList.filter(f =>
    f.status === 'conforme' || f.status === 'concluida' || f.status === 'concluida_ressalva'
  ).length;
  const progress = initialFvsList.length > 0 ? Math.round((concluidasCount / initialFvsList.length) * 100) : 0;

  const alreadyLinkedIds = initialFvsList.map(f => f.fvs_padrao_id);

  const fvsDeleteTarget = initialFvsList.find(f => f.id === fvsToDelete) ?? null;

  function handleDeleteFvs() {
    if (!fvsToDelete) return;
    startTransition(async () => {
      const result = await deleteFvsPlanejada(ambiente.obra_id, ambiente.id, fvsToDelete);
      if (result.success) {
        toast('FVS excluída com sucesso.', 'success');
        setFvsToDelete(null);
        router.refresh();
      } else {
        toast(result.error ?? 'Erro ao excluir FVS.', 'error');
        setFvsToDelete(null);
      }
    });
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6">
      
      {/* Left Panel: FVS Planejadas */}
      <div className="flex-1 flex flex-col bg-bg-1 border border-brd-0 rounded-xl overflow-hidden min-h-[500px]">
        <div className="px-5 py-4 border-b border-brd-0 bg-bg-0 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-txt tracking-tight">FVS Planejadas</h2>
            <p className="text-xs text-txt-2">{initialFvsList.length} serviços • {concluidasCount} concluídos</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="prumo-row-button"
          >
            + Adicionar
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {initialFvsList.length > 0 ? (
           <table className="w-full text-left">
             <thead>
               <tr className="border-b border-brd-0 bg-bg-0">
                 <th className="py-2.5 px-5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Serviço</th>
                 <th className="py-2.5 px-5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Status</th>
                 <th className="py-2.5 px-5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2 text-right">Ações</th>
               </tr>
             </thead>
             <tbody>
               {initialFvsList.map((fvs) => (
                 <tr key={fvs.id} className="border-b border-brd-0 last:border-0 hover:bg-bg-2">
                   <td className="py-3 px-5">
                     <div className="flex items-center gap-3">
                       <div className={`w-2.5 h-2.5 rounded-full ${fvs.ncs_abertas > 0 ? 'bg-nok' : (fvs.status === 'conforme' || fvs.status === 'concluida') ? 'bg-ok' : fvs.status === 'concluida_ressalva' ? 'bg-warn' : 'bg-[var(--br)]'}`} />
                       <div>
                         <h3 className="font-medium text-sm text-txt">{fvs.subservico}</h3>
                         <p className="text-[11px] text-txt-3">Última verif: {fvs.ultima_verif ? new Date(fvs.ultima_verif).toLocaleDateString('pt-BR') : 'Nenhuma'}</p>
                       </div>
                     </div>
                   </td>
                   <td className="py-3 px-5">
                     <div className="flex items-center gap-2">
                       <StatusBadge status={fvs.status} size="sm" />
                       {fvs.ncs_abertas > 0 ? (
                         <span className="inline-flex items-center gap-1 rounded-full border border-nok/20 bg-nok-bg px-2 py-1 text-[11px] font-medium text-nok">
                           <AlertTriangle size={12} />
                           {fvs.ncs_abertas} NC {fvs.ncs_abertas === 1 ? 'aberta' : 'abertas'}
                         </span>
                       ) : null}
                     </div>
                   </td>
                   <td className="py-3 px-5 text-right">
                     <div className="flex items-center justify-end gap-3">
                       {measurementEnabled ? (
                         <Link
                           href={`/obras/${ambiente.obra_id}/ambiente/${ambiente.id}/fvs/${fvs.id}/medicao`}
                           className="text-xs font-semibold text-ok hover:underline"
                         >
                           Medição
                         </Link>
                       ) : null}
                        <a
                          href={`/admin/relatorio/fvs/${fvs.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-txt-3 hover:text-brand rounded transition-colors"
                          title="Exportar PDF"
                        >
                          <FileText size={14} />
                        </a>
                        {fvs.total_verificacoes === 0 ? (
                          <button
                            onClick={() => setFvsToDelete(fvs.id)}
                            className="p-1 text-txt-3 hover:text-nok rounded transition-colors"
                            title="Excluir FVS"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedFvsId(fvs.id)}
                          className="prumo-row-button"
                        >
                          Ver checklist
                        </button>
                     </div>
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

      <ConfirmDialog
        isOpen={!!fvsToDelete}
        onClose={() => setFvsToDelete(null)}
        onConfirm={handleDeleteFvs}
        title="Excluir FVS"
        message={`Tem certeza que deseja excluir "${fvsDeleteTarget?.subservico || 'esta FVS'}"? Esta ação é permanente e não pode ser desfeita.`}
        confirmText="Sim, Excluir"
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
