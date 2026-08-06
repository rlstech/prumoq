import { createClient } from '@/lib/supabase/server';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusBadge from '@/components/ui/StatusBadge';
import { Building2, Layers, ClipboardCheck, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: countObras },
    { count: countAmbientes },
    { count: countFvsConcluidas },
    { count: countNcAbertas },
    { data: obrasProgressoData },
    { data: verifsRecentesData },
    { data: ncsUrgentesData },
    { data: measurementIndicatorsData },
    { data: ncFinanceiroData },
  ] = await Promise.all([
    supabase.from('obras' as any).select('*', { count: 'exact', head: true }).neq('status', 'concluida').eq('ativo', true),
    supabase.from('ambientes' as any).select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('fvs_planejadas' as any).select('*', { count: 'exact', head: true }).in('status', ['conforme', 'concluida', 'concluida_ressalva']),
    supabase.from('nao_conformidades' as any).select('*', { count: 'exact', head: true }).eq('status', 'aberta'),
    (supabase.rpc as any)('get_obras_progresso_dashboard'),
    (supabase.rpc as any)('get_verificacoes_recentes'),
    (supabase.rpc as any)('get_ncs_urgentes'),
    supabase.from('vw_indicadores_medicoes').select('*'),
    supabase.from('nao_conformidades' as any).select('situacao_financeira, valor_estimado, valor_confirmado').in('situacao_financeira', ['em_avaliacao', 'estimado', 'confirmado']),
  ]);

  const obrasProgresso = (obrasProgressoData as any[]) || [];
  const verifsRecentes = (verifsRecentesData as any[]) || [];
  const ncsUrgentes = (ncsUrgentesData as any[]) || [];
  const measurementIndicators = measurementIndicatorsData ?? [];
  const measurementSummary = measurementIndicators.reduce((summary, item) => ({
    available: summary.available + Number(item.quantidade_disponivel ?? 0),
    value: summary.value + Number(item.valor_disponivel ?? 0),
    blocked: summary.blocked + Number(item.quantidade_bloqueada ?? 0),
  }), { available: 0, value: 0, blocked: 0 });

  // Custo com retrabalho — todas as situações de impacto financeiro
  // (confirmado usa valor_confirmado com fallback; em_avaliacao/estimado usam valor_estimado)
  const reworkCost = ((ncFinanceiroData as any[]) ?? []).reduce(
    (total, nc) => total + Number(nc.valor_confirmado ?? nc.valor_estimado ?? 0),
    0,
  );

  return (
    <div className="prumo-page">
      <div className="prumo-page-inner">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="prumo-kicker text-[var(--prumo-brand)]">Centro de controle</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-txt">A operação, em eixo.</h1>
            <p className="mt-2 text-sm text-txt-2">Resumo operacional de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
          </div>
          <Link href="/obras" className="prumo-primary-button">Abrir portfólio <span aria-hidden="true">→</span></Link>
        </div>

        {(measurementIndicators.length || reworkCost > 0) && (
          <Link href="/medicoes" className="grid gap-3 rounded-xl border border-brd-0 bg-bg-1 p-4 transition-colors hover:bg-bg-0 sm:grid-cols-4">
            <div><div className="text-[10px] font-semibold uppercase text-txt-3">Pronto para medir</div><div className="mt-1 text-lg font-semibold text-ok">{measurementSummary.available.toLocaleString('pt-BR')}</div></div>
            <div><div className="text-[10px] font-semibold uppercase text-txt-3">Valor disponível</div><div className="mt-1 text-lg font-semibold text-txt">{measurementSummary.value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div></div>
            <div><div className="text-[10px] font-semibold uppercase text-txt-3">Bloqueado por NC</div><div className="mt-1 text-lg font-semibold text-nok">{measurementSummary.blocked.toLocaleString('pt-BR')}</div></div>
            <div><div className="text-[10px] font-semibold uppercase text-txt-3">Custo com retrabalho</div><div className="mt-1 text-lg font-semibold text-warn">{reworkCost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div></div>
          </Link>
        )}

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
          <div className="prumo-panel flex min-h-[166px] flex-col justify-between p-5">
            <Layers size={20} className="text-pg" />
            <div><div className="prumo-metric text-2xl font-semibold text-txt">{countAmbientes || 0}</div><div className="mt-1 text-xs text-txt-2">Ambientes mapeados</div></div>
          </div>
          <div className="prumo-panel flex min-h-[166px] flex-col justify-between p-5">
            <ClipboardCheck size={20} className="text-ok" />
            <div><div className="prumo-metric text-2xl font-semibold text-txt">{countFvsConcluidas || 0}</div><div className="mt-1 text-xs text-txt-2">FVS concluídas</div></div>
          </div>
          <div className="prumo-panel flex min-h-[166px] flex-col justify-between p-5">
            <AlertTriangle size={20} className="text-nok" />
            <div><div className="prumo-metric text-2xl font-semibold text-txt">{countNcAbertas || 0}</div><div className="mt-1 text-xs text-txt-2">NC exigem atenção</div></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Progresso de Obras (2/3) */}
          <div className="prumo-panel flex flex-col overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-brd-0 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-txt">Progresso das obras</h3>
              <Link href="/obras" className="text-xs font-medium text-txt-2 hover:text-txt transition-colors">Ver todas →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-0 border-b border-brd-0">
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Obra</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Empresa</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Amb.</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Progresso FVS</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">NC</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {obrasProgresso.length ? obrasProgresso.map((obra: any) => {
                    const percent = Math.round(obra.progresso_percentual ?? (obra.total_fvs > 0 ? (obra.fvs_concluidas / obra.total_fvs) * 100 : 0));
                    return (
                      <tr key={obra.id} className="border-b border-brd-0 last:border-0 hover:bg-bg-0">
                        <td className="py-3 px-4">
                          <Link href={`/obras/${obra.id}`} className="font-medium text-[13px] text-txt hover:text-[var(--br)] transition-colors">
                            {obra.nome}
                          </Link>
                          <div className="text-xs text-txt-2 mt-0.5">{obra.municipio || ''}{obra.uf ? `-${obra.uf}` : ''}</div>
                        </td>
                        <td className="py-3 px-4 text-[13px] text-txt">{obra.empresa_nome || '-'}</td>
                        <td className="py-3 px-4 text-[13px] text-txt">{obra.total_ambientes || 0}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-[100px]"><ProgressBar value={percent} variant={percent === 100 ? 'ok' : 'brand'} /></div>
                            <span className="text-xs text-txt-3 whitespace-nowrap">{percent}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {obra.ncs_abertas > 0 ? (
                            <span className="inline-flex items-center bg-nok-bg text-nok px-2 py-0.5 rounded-full text-[11px] font-medium border border-nok/20">{obra.ncs_abertas} abertas</span>
                          ) : (
                            <span className="inline-flex items-center bg-ok-bg text-ok px-2 py-0.5 rounded-full text-[11px] font-medium border border-ok/20">0 abertas</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
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

          {/* Atividade Recente (1/3) */}
          <div className="prumo-panel flex flex-col">
            <div className="px-5 py-4 border-b border-brd-0">
              <h3 className="text-[14px] font-semibold text-txt">Atividade recente</h3>
            </div>
            <div className="flex-1 flex flex-col">
              {verifsRecentes.length ? verifsRecentes.slice(0, 6).map((item: any, idx: number) => {
                const isNC = item.tipo === 'nc';
                const isVerif = item.tipo === 'verificacao';
                const dotClass = isNC ? 'bg-nok' : isVerif ? 'bg-ok' : 'bg-pg';
                return (
                  <div key={idx} className="px-4 py-3 border-b border-brd-0 last:border-0">
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotClass}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-txt">{item.titulo || 'Verificação concluída'}</div>
                        <div className="text-[11px] text-txt-2 mt-0.5 truncate">{item.descricao || item.ambiente_nome || '-'}</div>
                      </div>
                      <div className="text-[11px] text-txt-3 whitespace-nowrap shrink-0">{item.tempo_relativo || '-'}</div>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <p className="text-xs text-txt-3">Nenhuma atividade registrada.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NCs urgentes (full width) */}
        <div className="prumo-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-brd-0 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-txt flex items-center gap-2">
              <AlertTriangle size={15} className="text-nok" />
              Não conformidades com prazo urgente
            </h3>
            <Link href="/nc" className="text-xs font-medium text-txt-2 hover:text-txt transition-colors">Ver todas →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-0 border-b border-brd-0">
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Descrição</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Obra / Ambiente</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Prioridade</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Responsável</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Prazo</th>
                  <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {ncsUrgentes.length ? ncsUrgentes.map((nc: any) => (
                  <tr key={nc.id} className="border-b border-brd-0 last:border-0 hover:bg-bg-0">
<td className="py-3 px-4">
                       <div className="font-medium text-[13px] text-txt">{nc.descricao || nc.item_titulo || '-'}</div>
                       <div className="text-xs text-txt-2 mt-0.5">{nc.subservico || '-'}</div>
                     </td>
                     <td className="py-3 px-4 text-[13px] text-txt">
                       {nc.obra_nome}
                       <div className="text-xs text-txt-2 mt-0.5">{nc.ambiente_nome}</div>
                     </td>
                     <td className="py-3 px-4">
                       <div className="flex items-center gap-1.5 text-xs">
                         <div className={`w-2 h-2 rounded-full ${nc.prioridade === 'alta' ? 'bg-nok' : nc.prioridade === 'baixa' ? 'bg-pg' : 'bg-warn'}`} />
                         {nc.prioridade === 'alta' ? 'Alta' : nc.prioridade === 'baixa' ? 'Baixa' : 'Média'}
                       </div>
                     </td>
                     <td className="py-3 px-4 text-[13px] text-txt">{nc.equipe_nome || '-'}</td>
                     <td className="py-3 px-4">
                       <span className="inline-flex bg-nok-bg text-nok px-2 py-0.5 rounded-full text-[11px] font-medium border border-nok/20">
                         {nc.data_nova_verif ? new Date(nc.data_nova_verif + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : 'Sem prazo'}
                       </span>
                     </td>
                     <td className="py-3 px-4"><StatusBadge status={nc.status || 'aberta'} size="sm" /></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-txt-3 flex flex-col items-center justify-center">
                      <span className="text-ok">✓</span> Nenhuma NC com prazo urgente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
