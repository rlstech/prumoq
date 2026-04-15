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
  ] = await Promise.all([
    supabase.from('obras' as any).select('*', { count: 'exact', head: true }).neq('status', 'concluida').eq('ativo', true),
    supabase.from('ambientes' as any).select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('fvs_planejadas' as any).select('*', { count: 'exact', head: true }).eq('status', 'conforme'),
    supabase.from('nao_conformidades' as any).select('*', { count: 'exact', head: true }).eq('status', 'aberta'),
    (supabase.rpc as any)('get_obras_progresso_dashboard'),
    (supabase.rpc as any)('get_verificacoes_recentes'),
    (supabase.rpc as any)('get_ncs_urgentes'),
  ]);

  const obrasProgresso = (obrasProgressoData as any[]) || [];
  const verifsRecentes = (verifsRecentesData as any[]) || [];
  const ncsUrgentes = (ncsUrgentesData as any[]) || [];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[1200px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-txt tracking-tight">Visão Geral</h1>
            <p className="text-[13px] text-txt-2 mt-1">Resumo operacional — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* KPIs com border-left colorido */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[14px]">
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-[var(--br)] rounded-xl p-[18px_20px]">
            <div className="text-[28px] font-semibold text-[var(--br)] mb-0.5">{countObras || 0}</div>
            <div className="text-xs text-txt-2">Obras ativas</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-pg rounded-xl p-[18px_20px]">
            <div className="text-[28px] font-semibold text-pg mb-0.5">{countAmbientes || 0}</div>
            <div className="text-xs text-txt-2">Ambientes cadastrados</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-ok rounded-xl p-[18px_20px]">
            <div className="text-[28px] font-semibold text-ok mb-0.5">{countFvsConcluidas || 0}</div>
            <div className="text-xs text-txt-2">FVS concluídas</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-nok rounded-xl p-[18px_20px]">
            <div className="text-[28px] font-semibold text-nok mb-0.5">{countNcAbertas || 0}</div>
            <div className="text-xs text-txt-2">NC abertas</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Progresso de Obras (2/3) */}
          <div className="lg:col-span-2 bg-bg-1 border border-brd-0 rounded-xl overflow-hidden flex flex-col">
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
          <div className="bg-bg-1 border border-brd-0 rounded-xl flex flex-col">
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
        <div className="bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
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
                      <div className="font-medium text-[13px] text-txt">{nc.item_titulo || nc.descricao || '-'}</div>
                      <div className="text-xs text-txt-2 mt-0.5">{nc.servico_nome || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-txt">
                      {nc.obra_nome}
                      <div className="text-xs text-txt-2 mt-0.5">{nc.ambiente_nome}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className={`w-2 h-2 rounded-full ${nc.prioridade === 'Alta' ? 'bg-nok' : nc.prioridade === 'Baixa' ? 'bg-pg' : 'bg-warn'}`} />
                        {nc.prioridade || 'Média'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-txt">{nc.equipe_nome || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex bg-nok-bg text-nok px-2 py-0.5 rounded-full text-[11px] font-medium border border-nok/20">
                        {nc.prazo_correcao ? new Date(nc.prazo_correcao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'Sem prazo'}
                      </span>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status="aberta" size="sm" /></td>
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
