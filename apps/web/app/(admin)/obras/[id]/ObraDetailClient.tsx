'use client';

import { useState, useTransition } from 'react';
import { HardHat, Trash2 } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import AmbienteModal from './AmbienteModal';
import ObraEquipeModal from './ObraEquipeModal';
import { removeEquipeFromObra } from './actions';

interface ObraDetailClientProps {
  obraId: string;
  initialAmbientes: any[];
  fvsPadraoList: any[];
  obraEquipes: { id: string; nome: string; tipo: string; especialidade?: string }[];
  availableEquipes: { id: string; nome: string; tipo: string; especialidade?: string }[];
}

export default function ObraDetailClient({
  obraId,
  initialAmbientes,
  fvsPadraoList,
  obraEquipes,
  availableEquipes,
}: ObraDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('ambientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [isAmbienteModalOpen, setIsAmbienteModalOpen] = useState(false);
  const [isEquipeModalOpen, setIsEquipeModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = initialAmbientes.filter(a => {
    if (filterType === 'Com NC' && !(a.ncs_abertas > 0)) return false;
    if (filterType !== 'Todos' && filterType !== 'Com NC' && filterType !== a.tipo) return false;
    return (
      a.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.localizacao || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  function handleRemoveEquipe(equipeId: string) {
    setRemovingId(equipeId);
    startTransition(async () => {
      const result = await removeEquipeFromObra(obraId, equipeId);
      setRemovingId(null);
      if (result.success) {
        toast('Equipe removida da obra.', 'success');
        router.refresh();
      } else {
        toast(result.error ?? 'Erro ao remover equipe.', 'error');
      }
    });
  }

  const tabs = [
    { id: 'ambientes', label: 'Ambientes' },
    { id: 'equipe',    label: 'Equipe' },
    { id: 'docs',      label: 'Documentos' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-brd-0 mb-6">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-[13px] font-medium cursor-pointer border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'text-[var(--br)] border-[var(--br)]'
                : 'text-txt-2 border-transparent hover:text-txt'
            }`}
          >
            {tab.label}
            {tab.id === 'equipe' && obraEquipes.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-pg-bg text-pg font-semibold px-1.5 py-0.5 rounded-full">
                {obraEquipes.length}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Tab: Ambientes */}
      {activeTab === 'ambientes' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center mb-5">
            <div className="flex gap-1.5 flex-wrap">
              {['Todos', 'Internos', 'Externos', 'Com NC'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f === 'Internos' ? 'Interno' : f === 'Externos' ? 'Externo' : f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    filterType === f || (filterType === 'Interno' && f === 'Internos') || (filterType === 'Externo' && f === 'Externos')
                      ? 'bg-[var(--brl)] text-[var(--br)] border-[var(--br)]/20'
                      : f === 'Com NC'
                      ? 'bg-bg-0 text-nok border-nok/30 hover:bg-nok-bg'
                      : 'bg-bg-0 text-txt-2 border-brd-1 hover:bg-bg-2'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Filtrar ambiente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-brd-1 rounded-lg text-xs bg-bg-1 w-44 outline-none focus:border-[var(--br)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(amb => {
              const percent = amb.total_fvs > 0 ? Math.round((amb.fvs_concluidas / amb.total_fvs) * 100) : 0;
              const hasNC = amb.ncs_abertas > 0;
              return (
                <div
                  key={amb.id}
                  onClick={() => router.push(`/obras/${obraId}/ambiente/${amb.id}`)}
                  className="bg-bg-1 border border-brd-0 rounded-xl p-[14px] cursor-pointer hover:border-[var(--br)] hover:shadow-sm transition-all"
                  style={{ borderTopWidth: '3px', borderTopColor: hasNC ? 'var(--nok)' : amb.tipo === 'Interno' ? 'var(--pg)' : 'var(--ok)' }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-[13px] font-semibold text-txt">{amb.nome}</h4>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      hasNC ? 'bg-nok-bg text-nok' : percent >= 80 ? 'bg-ok-bg text-ok' : percent > 0 ? 'bg-pg-bg text-pg' : 'bg-na-bg text-na'
                    }`}>
                      {hasNC ? 'NC' : `${amb.fvs_concluidas}/${amb.total_fvs}`}
                    </span>
                  </div>
                  <p className="text-xs text-txt-2 mt-1">{amb.tipo} · {amb.localizacao}</p>
                  <div className="mt-2.5">
                    <ProgressBar value={percent} variant={hasNC ? 'nok' : percent === 100 ? 'ok' : 'brand'} />
                  </div>
                </div>
              );
            })}

            {/* Card "Novo ambiente" */}
            <div
              onClick={() => setIsAmbienteModalOpen(true)}
              className="bg-bg-0 border-2 border-dashed border-brd-1 rounded-xl flex flex-col items-center justify-center min-h-[100px] cursor-pointer hover:border-[var(--br)] hover:bg-bg-1 transition-all gap-1.5"
            >
              <span className="text-xl text-txt-3">+</span>
              <span className="text-xs text-txt-3">Novo ambiente</span>
            </div>
          </div>
        </>
      )}

      {/* Tab: Equipe */}
      {activeTab === 'equipe' && (
        <div className="bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-brd-0 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-txt">Equipe da obra</h3>
            <button
              onClick={() => setIsEquipeModalOpen(true)}
              className="px-3 py-1.5 bg-[var(--br)] text-white rounded-lg text-xs font-medium hover:bg-[var(--brd)] transition-colors"
            >
              + Adicionar
            </button>
          </div>

          {obraEquipes.length > 0 ? (
            obraEquipes.map(eq => {
              const isProprio = eq.tipo === 'proprio';
              const isRemoving = removingId === eq.id && isPending;
              return (
                <div key={eq.id} className="flex items-center gap-3 px-4 py-3 border-b border-brd-0 last:border-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    isProprio ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                  }`}>
                    {eq.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[13px] font-medium text-txt">{eq.nome}</h5>
                    <p className="text-xs text-txt-2 mt-0.5">{eq.especialidade || 'Geral'}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isProprio ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                  }`}>
                    {isProprio ? 'Próprio' : 'Terceirizado'}
                  </span>
                  <button
                    onClick={() => handleRemoveEquipe(eq.id)}
                    disabled={isRemoving}
                    title="Remover da obra"
                    className="p-1.5 text-txt-3 hover:text-nok hover:bg-nok-bg rounded-lg transition-colors disabled:opacity-40 ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center text-sm text-txt-3 flex flex-col items-center gap-2">
              <HardHat size={24} className="opacity-40" />
              <span>Nenhuma equipe vinculada a esta obra.</span>
              <button
                onClick={() => setIsEquipeModalOpen(true)}
                className="mt-1 text-xs text-[var(--br)] hover:underline font-medium"
              >
                + Adicionar equipe
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Documentos */}
      {activeTab === 'docs' && (
        <div className="py-10 text-center text-sm text-txt-3">
          Funcionalidade de documentos disponível na versão completa.
        </div>
      )}

      {isAmbienteModalOpen && (
        <AmbienteModal
          isOpen={isAmbienteModalOpen}
          onClose={() => setIsAmbienteModalOpen(false)}
          obraId={obraId}
          fvsPadraoList={fvsPadraoList}
        />
      )}

      {isEquipeModalOpen && (
        <ObraEquipeModal
          isOpen={isEquipeModalOpen}
          onClose={() => setIsEquipeModalOpen(false)}
          obraId={obraId}
          availableEquipes={availableEquipes}
        />
      )}
    </div>
  );
}
