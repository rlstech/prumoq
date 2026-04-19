import { createClient } from '@supabase/supabase-js';
import Header from '@/components/layout/Header';
import NcClient from './NcClient';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function NcPage() {
  const { data: ncsData } = await supabaseAdmin
    .from('nao_conformidades' as any)
    .select(`
      *,
      equipes(nome),
      verificacoes!nao_conformidades_verificacao_id_fkey(
        fvs_planejadas(subservico, ambientes(nome, obras(nome))),
        usuarios(nome)
      )
    `)
    .order('data_nova_verif', { ascending: true, nullsFirst: false });

  const rawNcs = (ncsData as any[]) || [];

  const ncs = rawNcs.map((nc: any) => ({
    ...nc,
    fvs_planejadas: nc.verificacoes?.fvs_planejadas ?? null,
    usuarios: nc.verificacoes?.usuarios ?? null,
    verificacoes: undefined,
  }));

  const abertas = ncs.filter(n => n.status === 'aberta' || n.status === 'em_correcao').length;
  const resolvidas = ncs.filter(n => n.status === 'resolvida').length;

  const limiteUrgencia = new Date();
  limiteUrgencia.setDate(limiteUrgencia.getDate() + 3);
  const urgentes = ncs.filter(n => (n.status === 'aberta' || n.status === 'em_correcao') && n.data_nova_verif && new Date(n.data_nova_verif) <= limiteUrgencia).length;

  const resolvedNcs = ncs.filter(n => n.status === 'resolvida' && n.created_at && n.resolvida_em);
  const avgDays = resolvedNcs.length > 0
    ? (resolvedNcs.reduce((acc: number, nc: any) => acc + ((new Date(nc.resolvida_em).getTime() - new Date(nc.created_at).getTime()) / (1000 * 60 * 60 * 24)), 0) / resolvedNcs.length).toFixed(1)
    : '-';

  return (
    <>
      <Header breadcrumbs={[{ label: 'Não Conformidades' }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
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
            <div className="text-xs text-txt-2">Resolvidas</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-txt">{avgDays}d</div>
            <div className="text-xs text-txt-2">Tempo médio resolução</div>
          </div>
        </div>

        <NcClient initialData={ncs} />
        </div>
      </div>
    </>
  );
}