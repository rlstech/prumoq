import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import NcClient, { type NcListRecord } from './NcClient';

export const dynamic = 'force-dynamic';

interface NcQueryRecord {
  id: string;
  descricao: string;
  status: string;
  prioridade: string | null;
  data_nova_verif: string | null;
  created_at: string;
  resolvida_em: string | null;
  equipes: { nome: string } | null;
  verificacoes: {
    fvs_planejadas: NcListRecord['fvs_planejadas'];
  } | null;
}

export default async function NcPage() {
  const supabase = await createClient();
  const { data: ncsData } = await supabase
    .from('nao_conformidades')
    .select(`
      id, descricao, status, prioridade, data_nova_verif, created_at, resolvida_em,
      equipes(nome),
      verificacoes!nao_conformidades_verificacao_id_fkey(
        fvs_planejadas(subservico, ambientes(nome, obras(nome))),
        usuarios(nome)
      )
    `)
    .order('data_nova_verif', { ascending: true, nullsFirst: false });

  const rawNcs = (ncsData ?? []) as unknown as NcQueryRecord[];
  const ncs: NcListRecord[] = rawNcs.map(nc => ({
    id: nc.id,
    descricao: nc.descricao,
    status: nc.status,
    prioridade: nc.prioridade,
    data_nova_verif: nc.data_nova_verif,
    equipes: nc.equipes,
    fvs_planejadas: nc.verificacoes?.fvs_planejadas ?? null,
  }));

  const abertas = ncs.filter(nc => nc.status === 'aberta' || nc.status === 'em_correcao').length;
  const resolvidas = ncs.filter(nc => nc.status === 'resolvida').length;

  const limiteUrgencia = new Date();
  limiteUrgencia.setDate(limiteUrgencia.getDate() + 3);
  const urgentes = ncs.filter(nc => (
    (nc.status === 'aberta' || nc.status === 'em_correcao')
    && nc.data_nova_verif
    && new Date(`${nc.data_nova_verif.slice(0, 10)}T12:00:00`) <= limiteUrgencia
  )).length;

  const resolvedNcs = rawNcs.filter(nc => nc.status === 'resolvida' && nc.created_at && nc.resolvida_em);
  const avgDays = resolvedNcs.length > 0
    ? (
      resolvedNcs.reduce(
        (total, nc) => total + (
          (new Date(nc.resolvida_em as string).getTime() - new Date(nc.created_at).getTime())
          / 86_400_000
        ),
        0,
      ) / resolvedNcs.length
    ).toFixed(1)
    : '-';

  return (
    <>
      <Header breadcrumbs={[{ label: 'Não Conformidades' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
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
