import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import { createClient } from '@/lib/supabase/server';
import NcClient, { type NcListRecord } from './NcClient';
import { pageFromSearchParam, pageRange, pageSlice } from '@/lib/pagination';
import { getAuthContext } from '@/lib/auth/context';


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

export default async function NcPage({ searchParams }: { searchParams?: Promise<{ page?: string | string[] }> }) {
  const supabase = await createClient();
  const context = await getAuthContext();
  const page = pageFromSearchParam((await searchParams)?.page);
  const { from, to } = pageRange(page);
  const { data: ncsData } = await supabase
    .from('nao_conformidades')
    .select(`
      id, descricao, status, prioridade, data_nova_verif, created_at, resolvida_em,
      equipes(nome),
      verificacoes!nao_conformidades_verificacao_id_fkey(
        fvs_planejadas!verificacoes_fvs_planejada_id_fkey(subservico, ambientes!fvs_planejadas_ambiente_id_fkey(nome, obras!ambientes_obra_id_fkey(nome))),
        usuarios!inspetor_id(nome)
      )
    `)
    .eq('cliente_id', context?.clienteId ?? '')
    .order('data_nova_verif', { ascending: true, nullsFirst: false })
    .range(from, to);

  const { rows: rawNcs, hasNextPage } = pageSlice((ncsData ?? []) as unknown as NcQueryRecord[]);
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
      <Header breadcrumbs={[{ label: 'Não conformidades' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
        <PageHeader
          title="Não conformidades"
          description="Desvios abertos pelas vistorias. Uma NC só encerra com reinspeção conforme — o prazo comanda a ordem da fila."
        />
        <div className="flex flex-wrap gap-2">
          {[
            { valor: abertas, rotulo: 'abertas', tom: 'bg-nok-bg text-nok' },
            { valor: urgentes, rotulo: 'com prazo próximo', tom: 'bg-warn-bg text-warn' },
            { valor: resolvidas, rotulo: 'resolvidas', tom: 'bg-ok-bg text-ok' },
            { valor: avgDays === '-' ? '—' : `${avgDays} dias`, rotulo: 'tempo médio de resolução', tom: 'bg-bg-1 text-txt' },
          ].map(item => (
            <span key={item.rotulo} className={`prumo-pill h-9 px-4 text-[13px] ${item.tom}`}>
              <span className="prumo-metric text-[15px]">{item.valor}</span> {item.rotulo}
            </span>
          ))}
        </div>

        <NcClient initialData={ncs} page={page} hasNextPage={hasNextPage} />
        </div>
      </div>
    </>
  );
}
