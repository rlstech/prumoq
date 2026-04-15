import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import NcClient from './NcClient';
import { AlertTriangle, Clock, CheckCircle2, Timer } from 'lucide-react';

export default async function NcPage() {
  const supabase = await createClient();

  const { data: ncsData } = await supabase
    .from('nao_conformidades' as any)
    .select('*, equipes(nome), fvs_planejadas(subservico, ambientes(nome, obras(nome))), usuarios(nome)')
    .order('prazo_correcao', { ascending: true });

  const ncs = ncsData as any[] || [];

  const abertas = ncs.filter(n => n.status === 'aberta' || n.status === 'em_correcao').length;
  const resolvidas = ncs.filter(n => n.status === 'resolvida').length;
  
  const limiteUrgencia = new Date();
  limiteUrgencia.setDate(limiteUrgencia.getDate() + 3);
  const urgentes = ncs.filter(n => (n.status === 'aberta' || n.status === 'em_correcao') && n.prazo_correcao && new Date(n.prazo_correcao) <= limiteUrgencia).length;

  // Tempo médio de resolução
  const resolvedNcs = ncs.filter(n => n.status === 'resolvida' && n.created_at && n.updated_at);
  const avgDays = resolvedNcs.length > 0 
    ? (resolvedNcs.reduce((acc, nc) => acc + ((new Date(nc.updated_at).getTime() - new Date(nc.created_at).getTime()) / (1000 * 60 * 60 * 24)), 0) / resolvedNcs.length).toFixed(1)
    : '-';

  return (
    <>
      <Header breadcrumbs={[{ label: 'Não Conformidades' }]} />
      <div className="max-w-[1200px] mx-auto space-y-6 mt-6 px-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-nok rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-nok">{abertas}</div>
            <div className="text-xs text-txt-2">Abertas</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-warn rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-warn">{urgentes}</div>
            <div className="text-xs text-txt-2">Prazo próximo</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-ok rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-ok">{resolvidas}</div>
            <div className="text-xs text-txt-2">Resolvidas (mês)</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-txt">{avgDays}d</div>
            <div className="text-xs text-txt-2">Tempo médio resolução</div>
          </div>
        </div>

        <NcClient initialData={ncs} />
      </div>
    </>
  );
}
