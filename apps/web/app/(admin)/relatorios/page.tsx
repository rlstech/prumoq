import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import { FileText, Download } from 'lucide-react';

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const { data: obras } = await supabase.from('obras' as never).select('id, nome').eq('ativo', true);

  return (
    <>
      <Header breadcrumbs={[{ label: 'Relatórios e Exportações' }]} />
      <div className="max-w-[1200px] mx-auto space-y-6 mt-6 px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="bg-bg-1 border border-[var(--br)]/30 rounded-xl overflow-hidden shadow-sm flex flex-col group relative">
             <div className="absolute top-0 inset-x-0 h-1 bg-[var(--br)]" />
             <div className="p-5 flex-1">
                <div className="w-10 h-10 rounded-full bg-[var(--brl)] text-[var(--br)] flex items-center justify-center mb-4">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-bold text-txt mb-1">Ficha FVS Padrão</h3>
                <p className="text-sm text-txt-2 leading-relaxed mb-6">Gera o relatório completo de uma Ficha de Verificação de Serviço com todos os itens inspecionados, fotos associadas e assinaturas.</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-txt-2 mb-1 uppercase tracking-wider">Obra</label>
                    <select className="w-full px-3 py-2 border border-brd-1 rounded bg-bg-0 text-sm outline-none focus:border-[var(--br)]">
                       <option>Selecione uma obra</option>
                       {(obras as any[] || []).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div className="bg-warn-bg px-3 py-2 rounded border border-warn/20">
                     <p className="text-xs text-warn font-medium text-center">Geração de PDF com fotos via R2 será implementada na etapa de infraestrutura.</p>
                  </div>
                </div>
             </div>
             
             <button disabled className="w-full py-4 bg-bg-2 text-txt-3 text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-t border-brd-0 opacity-80 cursor-not-allowed transition-colors">
                <Download size={16} /> Exportar PDF
             </button>
          </div>

        </div>
      </div>
    </>
  );
}
