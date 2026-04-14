'use client';

import { useState } from 'react';
import ChecklistEditor, { ChecklistItemType } from '@/components/ChecklistEditor';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import Modal from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { History, Save } from 'lucide-react';

interface FvsEditorClientProps {
  fvs: any;
  initialItems: any[];
  logs: any[];
}

export default function FvsEditorClient({ fvs, initialItems, logs }: FvsEditorClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  
  const [items, setItems] = useState<ChecklistItemType[]>(initialItems.filter(i => i.revisao === fvs.revisao_atual));
  const [fvsData, setFvsData] = useState(fvs);
  
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [resumoAlteracoes, setResumoAlteracoes] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const getInUseCount = () => fvs.fvs_planejadas[0]?.count || 0;

  const handleToggleStatus = async (val: boolean) => {
    const supabase = createClient();
    const { error } = await (supabase.from('fvs_padrao') as any).update({ ativo: val }).eq('id', fvs.id);
    if (!error) {
       setFvsData({ ...fvsData, ativo: val });
       toast(`FVS ${val ? 'ativada' : 'inativada'}`, 'success');
    }
  };

  const publishRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumoAlteracoes) {
      toast('Descreva as alterações', 'error');
      return;
    }
    if (items.filter(i => !i.deleted).length === 0) {
      toast('A FVS precisa ter pelo menos um item', 'error');
      return;
    }

    setIsPublishing(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      toast('Sessão expirada. Faça login novamente.', 'error');
      setIsPublishing(false);
      return;
    }
    
    const novaRevisao = fvsData.revisao_atual + 1;

    // Atualiza info da fvs base
    const { error: fvsError } = await (supabase.from('fvs_padrao') as any).update({
      nome: fvsData.nome,
      categoria: fvsData.categoria,
      descricao: fvsData.descricao,
      norma_ref: fvsData.norma_ref,
      revisao_atual: novaRevisao,
    }).eq('id', fvs.id);

    if (fvsError) {
      toast('Erro ao atualizar dados.', 'error');
      setIsPublishing(false); return;
    }

    // Insere logs
    await supabase.from('fvs_padrao_revisoes' as never).insert([{
      fvs_padrao_id: fvs.id,
      numero_revisao: novaRevisao,
      revisado_por: user!.id,
      descricao_alt: resumoAlteracoes
    }] as any);

    // Insere items nova revisão
    const novosItens = items.filter(i => !i.deleted).map((it, idx) => ({
      fvs_padrao_id: fvs.id,
      revisao: novaRevisao,
      ordem: idx + 1,
      titulo: it.titulo,
      metodo_verif: it.metodo_verif,
      tolerancia: it.tolerancia
    }));

    await supabase.from('fvs_padrao_itens' as never).insert(novosItens as any);

    toast(`Revisão ${novaRevisao} publicada com sucesso!`, 'success');
    setIsPublishing(false);
    setIsPublishModalOpen(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-col xl:flex-row h-full max-w-[1400px] mx-auto p-6 gap-6">
        
        {/* Painel Esquerdo - Checklist Editor */}
        <div className="flex-1 flex flex-col h-full bg-bg-1 border border-brd-0 rounded-xl overflow-hidden shrink-0 min-h-[600px]">
           <div className="px-5 py-4 border-b border-brd-0 bg-bg-0 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h2 className="text-[14px] font-semibold text-txt tracking-tight">Itens de Verificação</h2>
                <p className="text-xs text-txt-2">{items.filter(i => !i.deleted).length} itens</p>
              </div>
              <button 
                onClick={() => setIsPublishModalOpen(true)}
                className="flex items-center gap-2 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Save size={16} /> Salvar Nova Revisão
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-5">
             <ChecklistEditor items={items} onChange={setItems} />
           </div>
        </div>

        {/* Painel Direito - Configurações */}
        <div className="w-full xl:w-[360px] flex flex-col gap-6 shrink-0 h-full overflow-y-auto pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-txt">Rev. {fvsData.revisao_atual}</h1>
            <div className="flex items-center gap-2 bg-bg-1 px-3 py-1.5 border border-brd-0 rounded-lg">
               <span className={`text-[11px] font-semibold uppercase ${fvsData.ativo ? 'text-ok' : 'text-txt-3'}`}>
                 {fvsData.ativo ? 'Ativa' : 'Inativa'}
               </span>
               <ToggleSwitch checked={fvsData.ativo} onChange={handleToggleStatus} />
            </div>
          </div>

          <div className="bg-bg-1 border border-brd-0 rounded-xl p-5">
             <h3 className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-4">Informações da Padrão</h3>
             
             <div className="space-y-4">
               <div>
                  <label className="block text-xs font-medium text-txt-2 mb-1">Nome *</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]"
                    value={fvsData.nome}
                    onChange={e => setFvsData({...fvsData, nome: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-medium text-txt-2 mb-1">Categoria *</label>
                  <select 
                    className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]"
                    value={fvsData.categoria}
                    onChange={e => setFvsData({...fvsData, categoria: e.target.value})}
                  >
                    {["Estrutura", "Vedação", "Revestimento", "Instalações", "Cobertura", "Acabamento"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
               </div>
               <div>
                 <label className="block text-xs font-medium text-txt-2 mb-1">Norma Ref.</label>
                 <input 
                   type="text"
                   className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]"
                   value={fvsData.norma_ref || ''}
                   onChange={e => setFvsData({...fvsData, norma_ref: e.target.value})}
                 />
               </div>
             </div>
          </div>

          <div className="bg-bg-1 border border-brd-0 rounded-xl p-5">
             <h3 className="text-xs font-bold text-txt-2 uppercase tracking-wider mb-4">Uso Atual</h3>
             <div className="flex bg-bg-0 border border-brd-0 rounded-lg divide-x divide-brd-0 p-3 text-center">
               <div className="flex-1">
                 <p className="text-xl font-bold text-txt">{getInUseCount()}</p>
                 <p className="text-[10px] uppercase text-txt-3 font-semibold mt-0.5">Ambientes</p>
               </div>
             </div>
          </div>

          <div className="bg-bg-1 border border-brd-0 rounded-xl flex flex-col flex-1 min-h-[200px]">
             <div className="px-5 py-3 border-b border-brd-0 bg-bg-0 flex items-center justify-between">
                <h3 className="text-xs font-bold text-txt-2 uppercase tracking-wider">Histórico</h3>
                <History size={14} className="text-txt-3" />
             </div>
             <div className="p-5 flex-1 overflow-y-auto space-y-4">
                {logs.length === 0 && <p className="text-xs text-txt-3 text-center">Nenhum log gravado.</p>}
                {logs.map((log: any) => (
                  <div key={log.id} className="border-l-2 pl-3 pb-2 last:pb-0" style={{ borderColor: log.numero_revisao === fvsData.revisao_atual ? 'var(--br)' : 'var(--brd0)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${log.numero_revisao === fvsData.revisao_atual ? 'bg-[var(--brl)] text-[var(--br)]' : 'bg-bg-2 text-txt-2'}`}>
                        v{log.numero_revisao}
                      </span>
                      <span className="text-[10px] text-txt-3">
                        {new Date(log.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-xs text-txt-2 mb-0.5">{log.descricao_alt}</p>
                    <p className="text-[10px] text-txt-3 italic">por {log.usuarios?.nome || 'Sistema'}</p>
                  </div>
                ))}
             </div>
          </div>
        </div>

      </div>

      <Modal isOpen={isPublishModalOpen} onClose={() => setIsPublishModalOpen(false)} title="Publicar Nova Revisão">
        <form onSubmit={publishRevision} className="flex flex-col gap-5 p-2">
          <div className="bg-warn-bg px-4 py-3 rounded-lg border border-warn/20 flex flex-col gap-1">
            <p className="text-sm font-semibold text-warn">Atenção, será criada a Rev. {fvsData.revisao_atual + 1}.</p>
            <p className="text-xs text-warn/80">Esta revisão afetará {getInUseCount()} ambientes atrelados a esta FVS.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-2 mb-2">Descreva as alterações desta revisão *</label>
            <textarea 
              className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-0 h-24 resize-none outline-none focus:border-[var(--br)] text-sm"
              value={resumoAlteracoes}
              onChange={e => setResumoAlteracoes(e.target.value)}
              placeholder="Descreva o que mudou nos itens de verificação..."
              required
            />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-brd-0">
             <button type="button" onClick={() => setIsPublishModalOpen(false)} className="px-5 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">
               Cancelar
             </button>
             <button type="submit" disabled={isPublishing} className="px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
               {isPublishing ? 'Salvando...' : `Publicar Rev. ${fvsData.revisao_atual + 1}`}
             </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
