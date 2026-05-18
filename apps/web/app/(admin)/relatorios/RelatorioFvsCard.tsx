'use client';

import { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Obra { id: string; nome: string; }
interface Fvs  { id: string; subservico: string; status: string; }

export default function RelatorioFvsCard({ obras }: { obras: Obra[] }) {
  const [obraId, setObraId]   = useState('');
  const [fvsList, setFvsList] = useState<Fvs[]>([]);
  const [fvsId, setFvsId]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!obraId) { setFvsList([]); setFvsId(''); return; }
    setLoading(true);
    setFvsId('');
    const supabase = createClient();
    (async () => {
      const { data: ams } = await supabase
        .from('ambientes' as any)
        .select('id')
        .eq('obra_id', obraId);
      const ambIds = ((ams as any[]) ?? []).map((a: any) => a.id);
      if (ambIds.length === 0) { setFvsList([]); setLoading(false); return; }
      const { data } = await supabase
        .from('fvs_planejadas' as any)
        .select('id, subservico, status')
        .in('ambiente_id', ambIds)
        .order('subservico');
      setFvsList((data as Fvs[]) ?? []);
      setLoading(false);
    })();
  }, [obraId]);

  function handleExport() {
    if (!fvsId) return;
    window.open(`/admin/relatorio/fvs/${fvsId}`, '_blank', 'noreferrer');
  }

  return (
    <div className="bg-bg-1 border border-[var(--br)]/30 rounded-xl overflow-hidden shadow-sm flex flex-col relative">
      <div className="absolute top-0 inset-x-0 h-1 bg-[var(--br)]" />
      <div className="p-5 flex-1">
        <div className="w-10 h-10 rounded-full bg-[var(--brl)] text-[var(--br)] flex items-center justify-center mb-4">
          <FileText size={20} />
        </div>
        <h3 className="text-lg font-bold text-txt mb-1">Ficha FVS Padrão</h3>
        <p className="text-sm text-txt-2 leading-relaxed mb-5">
          Gera o relatório completo de uma FVS com todos os itens inspecionados, fotos e assinaturas.
        </p>

        <div className="space-y-3">
          {/* Obra */}
          <div>
            <label className="block text-xs font-semibold text-txt-2 mb-1 uppercase tracking-wider">Obra</label>
            <select
              value={obraId}
              onChange={e => setObraId(e.target.value)}
              className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-0 text-sm outline-none focus:border-[var(--br)] transition-colors"
            >
              <option value="">Selecione uma obra</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          {/* FVS */}
          {obraId && (
            <div>
              <label className="block text-xs font-semibold text-txt-2 mb-1 uppercase tracking-wider">FVS</label>
              {loading ? (
                <div className="text-xs text-txt-3 py-2">Carregando...</div>
              ) : fvsList.length === 0 ? (
                <div className="text-xs text-txt-3 py-2">Nenhuma FVS encontrada para esta obra.</div>
              ) : (
                <select
                  value={fvsId}
                  onChange={e => setFvsId(e.target.value)}
                  className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-0 text-sm outline-none focus:border-[var(--br)] transition-colors"
                >
                  <option value="">Selecione uma FVS</option>
                  {fvsList.map(f => <option key={f.id} value={f.id}>{f.subservico}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={!fvsId}
        className="w-full py-4 text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-t border-brd-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={fvsId ? { background: '#E84A1A', color: 'white' } : { background: 'var(--bg-2)', color: 'var(--txt-3)' }}
      >
        <Download size={16} /> Exportar PDF
      </button>
    </div>
  );
}
