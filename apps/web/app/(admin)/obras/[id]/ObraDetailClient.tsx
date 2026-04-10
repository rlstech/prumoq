'use client';

import { useState } from 'react';
import { Layers, Plus, Search, HardHat } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';
import { useRouter } from 'next/navigation';
import AmbienteModal from './AmbienteModal';

interface ObraDetailClientProps {
  obraId: string;
  initialAmbientes: any[];
  fvsPadraoList: any[];
  equipeData: any[];
}

export default function ObraDetailClient({ obraId, initialAmbientes, fvsPadraoList, equipeData }: ObraDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ambientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = initialAmbientes.filter(a => {
    if (filterType === 'Com NC' && !(a.ncs_abertas > 0)) return false;
    if (filterType !== 'Todos' && filterType !== 'Com NC' && filterType !== a.tipo) return false;
    return a.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (a.localizacao || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

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
                    (filterType === f || (filterType === 'Interno' && f === 'Internos') || (filterType === 'Externo' && f === 'Externos'))
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
                  <div className="mt-2.5"><ProgressBar value={percent} variant={hasNC ? 'nok' : percent === 100 ? 'ok' : 'brand'} /></div>
                </div>
              );
            })}

            {/* Card "Novo ambiente" */}
            <div 
              onClick={() => setIsModalOpen(true)}
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
            <button className="px-3 py-1.5 bg-bg-0 border border-brd-1 rounded-lg text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors">+ Adicionar</button>
          </div>
          {equipeData.length > 0 ? equipeData.map((eq: any) => (
            <div key={eq.id} className="flex items-center gap-3 px-4 py-3 border-b border-brd-0 last:border-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                eq.tipo === 'Propria' ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
              }`}>
                {eq.nome.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-[13px] font-medium text-txt">{eq.nome}</h5>
                <p className="text-xs text-txt-2 mt-0.5">{eq.especialidade || 'Geral'}</p>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                eq.tipo === 'Propria' ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
              }`}>
                {eq.tipo === 'Propria' ? 'Próprio' : 'Terceirizado'}
              </span>
            </div>
          )) : (
            <div className="py-8 text-center text-sm text-txt-3 flex flex-col items-center gap-2">
              <HardHat size={24} className="text-txt-3 opacity-50" />
              Nenhuma equipe vinculada a esta obra.
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

      {isModalOpen && (
        <AmbienteModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          obraId={obraId}
          fvsPadraoList={fvsPadraoList}
        />
      )}
    </div>
  );
}
