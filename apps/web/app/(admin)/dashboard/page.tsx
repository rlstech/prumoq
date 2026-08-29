import { createClient } from '@/lib/supabase/server';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { AlertTriangle, ArrowRight, Building2, ClipboardCheck, Layers, Ruler, ScanLine } from 'lucide-react';
import Link from 'next/link';

/** Uma NC entra na fila crítica quando já venceu ou vence nas próximas 48 h. */
const JANELA_CRITICA_DIAS = 2;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: countObras },
    { count: countAmbientes },
    { count: countFvsConcluidas },
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

  const fila = [
    {
      href: '/nc',
      titulo: 'NC com prazo vencido ou vencendo',
      apoio: `no prazo de até ${JANELA_CRITICA_DIAS} dias`,
      valor: ncsCriticas,
      acao: 'Ver não conformidades',
      icon: AlertTriangle,
      cor: 'text-nok',
      fundo: 'bg-nok-bg',
      barra: 'bg-nok',
    },
    {
      href: '/nc',
      titulo: 'NC em correção',
      apoio: 'aguardam reinspeção para encerrar',
      valor: countNcEmCorrecao ?? 0,
      acao: 'Acompanhar correções',
      icon: ScanLine,
      cor: 'text-warn',
      fundo: 'bg-warn-bg',
      barra: 'bg-warn',
    },
    {
      href: '/medicoes',
      titulo: 'Medições aguardando aprovação',
      apoio: 'valor retido até a liberação',
      valor: countMedicoesPendentes ?? 0,
      acao: 'Ver medições',
      icon: Ruler,
      cor: 'text-pg',
      fundo: 'bg-pg-bg',
      barra: 'bg-pg',
    },
  ];

  const indicadores = [
    { valor: countAmbientes ?? 0, rotulo: 'Ambientes mapeados', icon: Layers, cor: 'text-pg', fundo: 'bg-pg-bg' },
    { valor: countFvsConcluidas ?? 0, rotulo: 'FVS concluídas', icon: ClipboardCheck, cor: 'text-ok', fundo: 'bg-ok-bg' },
    { valor: countNcAbertas ?? 0, rotulo: 'NC abertas', icon: AlertTriangle, cor: 'text-nok', fundo: 'bg-nok-bg' },
  ];

  return (
    <div className="prumo-page">
      <div className="prumo-page-inner">
        <PageHeader
          title="Visão geral"
          description={`O que exige decisão hoje, seguido do andamento do portfólio em ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.`}
          actions={
            <Link href="/obras" className="prumo-primary-button">
              Abrir portfólio <ArrowRight size={15} />
            </Link>
          }
        />

        <section>
          <h2 className="prumo-section-title mb-3">
            <span>Precisa de você hoje</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {fila.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.titulo}
                  href={item.href}
                  className="prumo-panel group relative flex flex-col justify-between overflow-hidden p-5 transition-shadow hover:shadow-float"
                >
                  {/* A barra assume o tom da fila: vermelho para prazo, âmbar para correção, azul para medição. */}
                  <span className={`absolute inset-y-0 left-0 w-[3px] ${item.barra}`} aria-hidden="true" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-txt">{item.titulo}</div>
                      <div className="mt-0.5 text-xs text-txt-3">{item.apoio}</div>
                    </div>
                    <div className={`shrink-0 rounded-lg p-2 ${item.fundo} ${item.cor}`}>
                      <Icon size={18} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <span className={`prumo-metric text-[32px] font-semibold leading-none ${item.cor}`}>{item.valor}</span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--br)]">
                      {item.acao}
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="prumo-panel mt-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-brd-0 px-5 py-4">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-txt">
                <AlertTriangle size={15} className="text-nok" />
                Não conformidades com prazo urgente
              </h3>
              <Link href="/nc" className="text-xs font-medium text-txt-2 transition-colors hover:text-txt">Ver todas →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-brd-0 bg-bg-0">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Descrição</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Obra / Ambiente</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Prioridade</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Responsável</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Prazo</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ncsUrgentes.length ? ncsUrgentes.map((nc: any) => (
                    <tr key={nc.id} className="border-b border-brd-0 last:border-0 hover:bg-bg-0">
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-txt">{nc.descricao || nc.item_titulo || '-'}</div>
                        <div className="mt-0.5 text-xs text-txt-2">{nc.subservico || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-txt">
                        {nc.obra_nome}
                        <div className="mt-0.5 text-xs text-txt-2">{nc.ambiente_nome}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className={`h-2 w-2 rounded-full ${nc.prioridade === 'alta' ? 'bg-nok' : nc.prioridade === 'baixa' ? 'bg-pg' : 'bg-warn'}`} />
                          {nc.prioridade === 'alta' ? 'Alta' : nc.prioridade === 'baixa' ? 'Baixa' : 'Média'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-txt">{nc.equipe_nome || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-nok/20 bg-nok-bg px-2 py-0.5 text-[11px] font-medium text-nok">
                          {nc.data_nova_verif ? new Date(nc.data_nova_verif + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : 'Sem prazo'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={nc.status || 'aberta'} size="sm" /></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-txt-3">
                        Nenhuma NC com prazo urgente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <h2 className="prumo-section-title mb-3">
            <span>Panorama do portfólio</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1.55fr_1fr_1fr_1fr]">
            <div className="prumo-datum relative min-h-[166px] overflow-hidden rounded-xl bg-sidebar p-6 text-white shadow-card md:col-span-2 xl:col-span-1">
              <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border border-accent/25" />
              <div className="absolute -right-3 -top-10 h-36 w-36 rounded-full border border-white/10" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[.14em] text-accent">Portfólio ativo</span>
                  <Building2 size={20} className="text-accent" />
                </div>
                <div>
                  <div className="prumo-metric text-[46px] font-semibold leading-none">{countObras || 0}</div>
                  <div className="mt-2 text-sm text-white/55">obras acompanhadas agora</div>
                </div>
              </div>
            </div>

            {indicadores.map(indicador => {
              const Icon = indicador.icon;
              return (
                <div key={indicador.rotulo} className="prumo-panel prumo-datum flex min-h-[166px] flex-col justify-between p-5">
                  <div className={`w-fit rounded-lg p-2 ${indicador.fundo} ${indicador.cor}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="prumo-metric text-2xl font-semibold text-txt">{indicador.valor}</div>
                    <div className="mt-1 text-xs text-txt-2">{indicador.rotulo}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="prumo-panel flex flex-col overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between border-b border-brd-0 px-5 py-4">
              <h3 className="text-[14px] font-semibold text-txt">Progresso das obras</h3>
              <Link href="/obras" className="text-xs font-medium text-txt-2 transition-colors hover:text-txt">Ver todas →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-brd-0 bg-bg-0">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Obra</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Empresa</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Amb.</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Progresso FVS</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">NC</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {obrasProgresso.length ? obrasProgresso.map((obra: any) => {
                    const percent = Math.round(obra.progresso_percentual ?? (obra.total_fvs > 0 ? (obra.fvs_concluidas / obra.total_fvs) * 100 : 0));
                    return (
                      <tr key={obra.id} className="border-b border-brd-0 last:border-0 hover:bg-bg-0">
                        <td className="px-4 py-3">
                          <Link href={`/obras/${obra.id}`} className="text-[13px] font-medium text-txt transition-colors hover:text-[var(--br)]">
                            {obra.nome}
                          </Link>
                          <div className="mt-0.5 text-xs text-txt-2">{obra.municipio || ''}{obra.uf ? `-${obra.uf}` : ''}</div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-txt">{obra.empresa_nome || '-'}</td>
                        <td className="px-4 py-3 text-[13px] text-txt">{obra.total_ambientes || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-[100px]"><ProgressBar value={percent} variant={percent === 100 ? 'ok' : 'brand'} /></div>
                            <span className="whitespace-nowrap text-xs text-txt-3">{percent}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {obra.ncs_abertas > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-nok/20 bg-nok-bg px-2 py-0.5 text-[11px] font-medium text-nok">{obra.ncs_abertas} abertas</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-ok/20 bg-ok-bg px-2 py-0.5 text-[11px] font-medium text-ok">0 abertas</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={obra.status || 'em_andamento'} size="sm" />
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-txt-3">Nenhuma obra encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="prumo-panel flex flex-col">
            <div className="border-b border-brd-0 px-5 py-4">
              <h3 className="text-[14px] font-semibold text-txt">Atividade recente</h3>
            </div>
            <div className="flex flex-1 flex-col">
              {verifsRecentes.length ? verifsRecentes.slice(0, 6).map((item: any, idx: number) => {
                const isNC = item.tipo === 'nc';
                const isVerif = item.tipo === 'verificacao';
                const dotClass = isNC ? 'bg-nok' : isVerif ? 'bg-ok' : 'bg-pg';
                return (
                  <div key={idx} className="border-b border-brd-0 px-4 py-3 last:border-0">
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-txt">{item.titulo || 'Verificação concluída'}</div>
                        <div className="mt-0.5 truncate text-[11px] text-txt-2">{item.descricao || item.ambiente_nome || '-'}</div>
                      </div>
                      <div className="shrink-0 whitespace-nowrap text-[11px] text-txt-3">{item.tempo_relativo || '-'}</div>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex flex-1 items-center justify-center p-8">
                  <p className="text-xs text-txt-3">Nenhuma atividade registrada.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
