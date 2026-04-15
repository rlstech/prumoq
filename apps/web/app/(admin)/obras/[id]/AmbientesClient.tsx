'use client';

import { useState } from 'react';
import { Layers, Plus, Search } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';
import { useRouter } from 'next/navigation';
import AmbienteModal from './AmbienteModal';

interface AmbientesClientProps {
  obraId: string;
  initialAmbientes: any[];
  fvsPadraoList: any[];
}

export default function AmbientesClient({ obraId, initialAmbientes, fvsPadraoList }: AmbientesClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = initialAmbientes.filter(a => {
    if (filterType !== 'Todos' && filterType !== a.tipo) return false;
    return a.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (a.localizacao || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-brd-0 pb-4">
        <div className="flex gap-6 w-full overflow-x-auto">
          <div className="font-semibold text-txt border-b-2 border-[var(--br)] pb-4 -mb-[17px]">
            Ambientes
          </div>
          <div className="text-txt-3 pb-4 -mb-[17px] cursor-not-allowed">
            Equipe <span className="text-[10px] bg-bg-2 px-1.5 rounded ml-1">Em breve</span>
          </div>
          <div className="text-txt-3 pb-4 -mb-[17px] cursor-not-allowed">
            Documentos <span className="text-[10px] bg-bg-2 px-1.5 rounded ml-1">Em breve</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <div className="flex gap-3 items-center w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
            <input 
              type="text"
              placeholder="Buscar ambiente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-brd-1 rounded-lg text-sm bg-bg-1 focus:outline-none focus:border-[var(--br)]"
            />
          </div>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-brd-1 rounded-lg text-sm bg-bg-1 focus:outline-none focus:border-[var(--br)]"
          >
            <option value="Todos">Todos</option>
            <option value="Interno">Interno</option>
            <option value="Externo">Externo</option>
          </select>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--br-light)] text-[var(--br)] hover:bg-[var(--brl)] border border-[var(--br)]/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus size={16} />
          Novo Ambiente
        </button>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(amb => (
            <div 
              key={amb.id}
              onClick={() => router.push(`/obras/${obraId}/ambiente/${amb.id}`)}
              className="bg-bg-1 border border-brd-0 rounded-xl p-4 cursor-pointer hover:border-[var(--br)] transition-colors group overflow-hidden relative"
            >
              <div 
                className="absolute top-0 inset-x-0 h-1" 
                style={{ backgroundColor: amb.tipo === 'Interno' ? '#1565C0' : '#2E7D32' }}
              />
              <div className="flex justify-between items-start mb-2 mt-1">
                <div>
                  <h3 className="font-semibold text-txt group-hover:text-[var(--br)] transition-colors">{amb.nome}</h3>
                  <p className="text-xs text-txt-2">{amb.localizacao} • {amb.tipo}</p>
                </div>
                {amb.ncs_abertas > 0 && (
                  <span className="w-5 h-5 flex items-center justify-center bg-nok-bg text-nok rounded-full text-[10px] font-bold" title={`${amb.ncs_abertas} NCs abertas`}>
                    {amb.ncs_abertas}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-txt-3 mb-1.5">
                <span>{amb.fvs_concluidas} de {amb.total_fvs} FVS</span>
                <span>{Math.round(amb.progresso_percentual ?? (amb.total_fvs > 0 ? (amb.fvs_concluidas / amb.total_fvs) * 100 : 0))}%</span>
              </div>
              <ProgressBar value={amb.progresso_percentual ?? (amb.total_fvs > 0 ? (amb.fvs_concluidas / amb.total_fvs) * 100 : 0)} variant="pg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-bg-1 rounded-xl border border-brd-0 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-bg-2 rounded-full flex items-center justify-center text-txt-3 mb-4">
             <Layers size={24} />
          </div>
          <h3 className="text-md font-semibold text-txt mb-1">Nenhum Ambiente</h3>
          <p className="text-sm text-txt-2 mb-4">Ainda não há ambientes cadastrados para esta obra.</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Cadastrar Ambiente
          </button>
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
