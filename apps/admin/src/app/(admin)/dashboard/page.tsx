import { createClient } from '@/lib/supabase/server';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import Header from '@/components/layout/Header';
import { ArrowRight, CalendarDays, ChevronRight, Plumb, RefreshCw, Ruler } from '@/components/icons';
import Link from '@/lib/compat/link';

/** Uma NC entra na fila crítica quando já venceu ou vence nas próximas 48 h. */
const JANELA_CRITICA_DIAS = 2;

const fmt = new Intl.NumberFormat('pt-BR');

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: countObras },
    { count: countAmbientes },
    { count: countFvsConcluidas },
    { count: countFvsTotal },
    { count: countNcAbertas },
    { count: countNcEmCorrecao },
    { count: countMedicoesPendentes },
    { data: obrasProgressoData },
    { data: verifsRecentesData },
    { data: ncsUrgentesData },
  ] = await Promise.all([
    supabase.from('obras' as any).select('*', { count: 'exact', head: true }).neq('status', 'concluida').eq('ativo', true),
    supabase.from('ambientes' as any).select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('fvs_planejadas' as any).select('*', { count: 'exact', head: true }).in('status', ['conforme', 'concluida', 'concluida_ressalva']),
    supabase.from('fvs_planejadas' as any).select('*', { count: 'exact', head: true }),
    supabase.from('nao_conformidades' as any).select('*', { count: 'exact', head: true }).eq('status', 'aberta'),
    supabase.from('nao_conformidades' as any).select('*', { count: 'exact', head: true }).eq('status', 'em_correcao'),
    supabase.from('medicoes_servico' as any).select('*', { count: 'exact', head: true }).eq('status', 'rascunho'),
    (supabase.rpc as any)('get_obras_progresso_dashboard'),
    (supabase.rpc as any)('get_verificacoes_recentes'),
    (supabase.rpc as any)('get_ncs_urgentes'),
  ]);

  const obrasProgresso = (obrasProgressoData as any[]) || [];
  const verifsRecentes = (verifsRecentesData as any[]) || [];
  const ncsUrgentes = (ncsUrgentesData as any[]) || [];

  const limiteCritico = new Date();
  limiteCritico.setHours(23, 59, 59, 999);
  limiteCritico.setDate(limiteCritico.getDate() + JANELA_CRITICA_DIAS);
  const ncsCriticas = ncsUrgentes.filter((nc: any) => {
    if (!nc.data_nova_verif) return false;
    return new Date(`${nc.data_nova_verif}T00:00:00`) <= limiteCritico;
  }).length;

  const fvsConcluidas = countFvsConcluidas ?? 0;
  const fvsTotal = countFvsTotal ?? 0;
  const avancoPortfolio = fvsTotal > 0 ? Math.round((fvsConcluidas / fvsTotal) * 100) : 0;

  const fila = [
    {
      href: '/nc',
      titulo: 'NCs com prazo vencido ou vencendo',
      apoio: `reinspeção nos próximos ${JANELA_CRITICA_DIAS} dias`,
      valor: ncsCriticas,
      icon: CalendarDays,
      cor: 'text-nok',
      fundo: 'bg-nok-bg',
    },
    {
      href: '/nc',
      titulo: 'NCs em correção',
      apoio: 'aguardam reinspeção para encerrar',
      valor: countNcEmCorrecao ?? 0,
      icon: RefreshCw,
      cor: 'text-warn',
      fundo: 'bg-warn-bg',
    },
    {
      href: '/medicoes',
      titulo: 'Medições aguardando aprovação',
      apoio: 'valor retido até a liberação',
      valor: countMedicoesPendentes ?? 0,
      icon: Ruler,
      cor: 'text-pg',
      fundo: 'bg-pg-bg',
    },
  ];

  const hoje = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
    <Header breadcrumbs={[{ label: 'Visão geral' }]} />
    <div className="prumo-page">
      <div className="prumo-page-inner">
        <PageHeader
          kicker={hoje.charAt(0).toUpperCase() + hoje.slice(1)}
          title="Visão geral"
          description="O que exige decisão hoje e, abaixo, o andamento das obras."
          actions={
            <>
              <Link href="/nc" className="prumo-secondary-button">Ver NCs</Link>
              <Link href="/obras" className="prumo-primary-button">
                Abrir obras <ArrowRight size={18} />
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section aria-label="Portfólio" className="flex min-w-0 flex-col gap-[18px]">
            <div className="px-1">
              <div className="text-[13px] font-semibold text-txt-2">Portfólio ativo</div>
              <div className="flex items-baseline gap-3">
                <span className="text-[72px] font-extrabold leading-none tracking-[-0.04em] text-txt">{countObras ?? 0}</span>
                <span className="text-lg font-medium text-txt-2">{countObras === 1 ? 'obra em andamento' : 'obras em andamento'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="prumo-pill h-8 bg-bg-1 px-3.5 text-[13px] font-semibold text-txt">
                  <span className="prumo-metric font-bold">{fmt.format(countAmbientes ?? 0)}</span> ambientes
                </span>
                <span className="prumo-pill h-8 bg-ok-bg px-3.5 text-[13px] text-ok">
                  <span className="prumo-metric">{fmt.format(fvsConcluidas)}</span> FVS concluídas
                </span>
                <span className="prumo-pill h-8 bg-nok-bg px-3.5 text-[13px] text-nok">
                  <span className="prumo-metric">{fmt.format(countNcAbertas ?? 0)}</span> NCs abertas
                </span>
              </div>
            </div>

            <div className="on-brand flex flex-1 flex-col justify-between gap-4 rounded-2xl bg-sidebar p-6 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-on-brand">Avanço das FVS no portfólio</div>
                  <div className="prumo-metric mt-1 text-[44px] font-bold leading-[1.05] tracking-[-0.02em]">{avancoPortfolio}%</div>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-txt">
                  <Plumb size={26} />
                </span>
              </div>
              <div>
                <div className="h-4 overflow-hidden rounded-full bg-brand-line">
                  <div className="prumo-tape-on-dark h-full rounded-full" style={{ width: `${avancoPortfolio}%` }} />
                </div>
                <div className="prumo-metric mt-2 text-xs text-on-brand">
                  {fmt.format(fvsConcluidas)} de {fmt.format(fvsTotal)} FVS
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="hoje" className="flex min-w-0 flex-col gap-2.5">
            <h2 id="hoje" className="px-1 text-lg font-bold text-txt">Precisa de você hoje</h2>
            <div className="flex flex-1 flex-col rounded-[28px] bg-bg-1 p-2">
              {fila.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={item.titulo}>
                    {idx > 0 ? <div className="ml-[84px] mr-[18px] h-px bg-brd-0" /> : null}
                    <Link
                      href={item.href}
                      className="group flex items-center gap-4 rounded-[22px] p-4 transition-colors hover:bg-bg-hover"
                    >
                      <span className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] ${item.fundo} ${item.cor}`}>
                        <Icon size={24} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold text-txt">{item.titulo}</span>
                        <span className="block text-[13px] text-txt-2">{item.apoio}</span>
                      </span>
                      <span className={`prumo-metric text-[30px] font-bold ${item.cor}`}>{item.valor}</span>
                      <ChevronRight size={18} className="shrink-0 text-txt-2 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="urgentes" className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 id="urgentes" className="text-lg font-bold text-txt">NCs com prazo urgente</h2>
              <Link href="/nc" className="text-[13px] font-semibold text-txt-2 hover:text-txt">Ver todas</Link>
            </div>
            <div className="prumo-panel flex-1 overflow-x-auto px-2 py-1.5">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="prumo-th">Não conformidade</th>
                    <th className="prumo-th">Obra · ambiente</th>
                    <th className="prumo-th">Responsável</th>
                    <th className="prumo-th">Prazo</th>
                    <th className="prumo-th">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {ncsUrgentes.length ? ncsUrgentes.map((nc: any) => {
                    const prazo = nc.data_nova_verif ? new Date(`${nc.data_nova_verif}T00:00:00`) : null;
                    const vencida = Boolean(prazo && prazo < new Date());
                    return (
                      <tr key={nc.id} className="border-t border-brd-0 hover:bg-bg-hover">
                        <td className="px-4 py-3">
                          <Link href={`/nc/${nc.id}`} className="block text-sm font-semibold text-txt hover:underline">
                            {nc.descricao || nc.item_titulo || '-'}
                          </Link>
                          <div className="mt-0.5 text-[13px] text-txt-2">{nc.subservico || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt">
                          {nc.obra_nome}
                          <div className="mt-0.5 text-[13px] text-txt-2">{nc.ambiente_nome}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt">{nc.equipe_nome || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`prumo-pill ${vencida ? 'bg-nok-bg text-nok' : 'bg-warn-bg text-warn'}`}>
                            {vencida
                              ? 'Vencida'
                              : prazo
                                ? prazo.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
                                : 'Sem prazo'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={nc.status || 'aberta'} tipo="nc" /></td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="border-t border-brd-0 px-4 py-10 text-center text-sm text-txt-2">
                        Nenhuma NC com prazo urgente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="atividade" className="flex min-w-0 flex-col gap-2.5">
            <h2 id="atividade" className="px-1 text-lg font-bold text-txt">Atividade recente</h2>
            <div className="prumo-panel flex flex-1 flex-col px-[18px] py-2">
              {verifsRecentes.length ? verifsRecentes.slice(0, 6).map((item: any, idx: number) => {
                const isNC = item.tipo === 'nc';
                const isVerif = item.tipo === 'verificacao';
                const dotClass = isNC ? 'bg-nok' : isVerif ? 'bg-ok' : 'bg-pg';
                return (
                  <div key={idx} className={`flex items-center gap-3.5 py-3 ${idx ? 'border-t border-brd-0' : ''}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-txt">{item.titulo || 'Verificação concluída'}</div>
                      <div className="truncate text-[13px] text-txt-2">{item.descricao || item.ambiente_nome || '-'}</div>
                    </div>
                    <div className="prumo-metric shrink-0 whitespace-nowrap text-xs text-txt-2">{item.tempo_relativo || '-'}</div>
                  </div>
                );
              }) : (
                <div className="flex flex-1 items-center justify-center p-8">
                  <p className="text-sm text-txt-2">Nenhuma atividade registrada.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section aria-labelledby="progresso" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 id="progresso" className="text-lg font-bold text-txt">Progresso das obras</h2>
            <Link href="/obras" className="text-[13px] font-semibold text-txt-2 hover:text-txt">Ver todas</Link>
          </div>
          <div className="prumo-panel overflow-x-auto px-2 py-1.5">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="prumo-th">Obra</th>
                  <th className="prumo-th">Empresa</th>
                  <th className="prumo-th text-right">Ambientes</th>
                  <th className="prumo-th">Avanço das FVS</th>
                  <th className="prumo-th">NCs</th>
                  <th className="prumo-th">Situação</th>
                </tr>
              </thead>
              <tbody>
                {obrasProgresso.length ? obrasProgresso.map((obra: any) => {
                  const percent = Math.round(obra.progresso_percentual ?? (obra.total_fvs > 0 ? (obra.fvs_concluidas / obra.total_fvs) * 100 : 0));
                  return (
                    <tr key={obra.id} className="border-t border-brd-0 hover:bg-bg-hover">
                      <td className="px-4 py-3">
                        <Link href={`/obras/${obra.id}`} className="block text-sm font-bold text-txt hover:underline">
                          {obra.nome}
                        </Link>
                        <div className="mt-0.5 text-[13px] text-txt-2">{obra.municipio || ''}{obra.uf ? `-${obra.uf}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-txt">{obra.empresa_nome || '-'}</td>
                      <td className="prumo-metric px-4 py-3 text-right text-[13px] text-txt">{obra.total_ambientes || 0}</td>
                      <td className="px-4 py-3">
                        <div className="w-[220px]"><ProgressBar value={percent} showLabel /></div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`prumo-pill ${obra.ncs_abertas > 0 ? 'bg-nok-bg text-nok' : 'bg-na-bg text-na'}`}>
                          {obra.ncs_abertas > 0 ? `${obra.ncs_abertas} ${obra.ncs_abertas > 1 ? 'abertas' : 'aberta'}` : 'nenhuma'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={obra.status || 'em_andamento'} />
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="border-t border-brd-0 py-10 text-center text-sm text-txt-2">Nenhuma obra encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
    </>
  );
}
