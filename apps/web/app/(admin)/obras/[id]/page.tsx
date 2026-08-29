import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/context';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import ObraDetailClient from './ObraDetailClient';

function formatarData(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10).split('-').reverse().join('/');
}

export default async function ObraDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const supabase = await createClient();
  const authContext = await getAuthContext();

  const [
    { data: obra },
    { data: kpi },
    { data: ambientes },
    { data: fvsPadrao },
    { data: empresas },
    { count: totalUsuariosVinculados },
  ] = await Promise.all([
    supabase.from('obras' as any).select('*').eq('id', id).single(),
    (supabase.rpc as any)('get_obra_kpi', { p_obra_id: id }).single(),
    (supabase.rpc as any)('get_ambientes_obra', { p_obra_id: id }),
    supabase.from('fvs_padrao' as any).select('id, nome, revisao_atual, categoria, escopo, fvs_padrao_empresas!fvs_padrao_empresas_fvs_padrao_id_fkey(empresa_id)').eq('ativo', true),
    supabase.from('empresas').select('id, nome').eq('ativo', true),
    supabase.from('obra_usuarios' as any).select('id', { count: 'exact', head: true }).eq('obra_id', id),
  ]);

  const typedObra = obra as any;
  if (!typedObra) return notFound();

  const empresasList: any[] = (empresas as any[] | null) ?? [];
  const empresaNome = empresasList.find((e: any) => e.id === typedObra.empresa_id)?.nome ?? '';

  const [obraEquipesLinks] = await Promise.all([
    supabase.from('obra_equipes' as any).select('equipe_id').eq('obra_id', id),
  ]);

  const linkedIds: string[] = ((obraEquipesLinks?.data as any[]) ?? []).map((r: any) => r.equipe_id).filter(Boolean);

  // Ambientes com verificação registrada (não podem ser excluídos)
  const { data: fvsVerifData } = (await supabase
    .from('fvs_planejadas' as any)
    .select('ambiente_id, verificacoes!verificacoes_fvs_planejada_id_fkey(count)')) as { data: any[] | null };
  const ambientesWithVerificacoes: Record<string, boolean> = {};
  for (const f of (fvsVerifData ?? [])) {
    if ((f.verificacoes?.[0]?.count ?? 0) > 0) ambientesWithVerificacoes[f.ambiente_id] = true;
  }

  // Serviços com medição configurada (aba Medições)
  const ambientesList: any[] = (ambientes as any[]) ?? [];
  let medicoesServices: any[] = [];
  if (typedObra.controle_medicoes_efetivo && ambientesList.length) {
    const ambIds = ambientesList.map((a: any) => a.id);
    const { data: fvsOfObra } = await supabase
      .from('fvs_planejadas' as any)
      .select('id, ambiente_id')
      .in('ambiente_id', ambIds);
    const fvsIds: string[] = ((fvsOfObra as any[]) ?? []).map((f: any) => f.id);

    if (fvsIds.length) {
      const [{ data: configsRaw }, { data: balancesRaw }, { data: activeLinksRaw }] = await Promise.all([
        supabase.from('fvs_medicao_configuracoes' as any)
          .select('fvs_planejada_id, metodo, unidade, quantidade_total, preco_unitario, fvs_planejadas!fvs_medicao_configuracoes_fvs_planejada_id_fkey(id, subservico, ambiente_id, ambientes!fvs_planejadas_ambiente_id_fkey(nome))')
          .in('fvs_planejada_id', fvsIds),
        supabase.from('vw_saldos_medicao_servico' as any)
          .select('fvs_planejada_id, escopo_atribuido, aprovado, medido, bloqueado, disponivel, valor_disponivel')
          .in('fvs_planejada_id', fvsIds),
        supabase.from('vinculos_execucao_servico' as any)
          .select('fvs_planejada_id, equipe_id, data_inicio')
          .eq('status', 'ativo')
          .in('fvs_planejada_id', fvsIds),
      ]);

      const configsList: any[] = (configsRaw as any[]) ?? [];
      const balancesList: any[] = (balancesRaw as any[]) ?? [];
      const activeLinksList: any[] = (activeLinksRaw as any[]) ?? [];

      const teamIds = Array.from(new Set(activeLinksList.map((l: any) => l.equipe_id).filter(Boolean)));
      const { data: teamsRaw } = teamIds.length
        ? await supabase.from('equipes' as any).select('id, nome').in('id', teamIds)
        : { data: [] };
      const teamNames = new Map(((teamsRaw as any[]) ?? []).map((t: any) => [t.id, t.nome]));
      const ambienteNames = new Map(ambientesList.map((a: any) => [a.id, a.nome]));

      medicoesServices = configsList.map((c: any) => {
        const fvs = c.fvs_planejadas;
        const links = activeLinksList.filter((l: any) => l.fvs_planejada_id === fvs?.id);
        const sums = balancesList
          .filter((b: any) => b.fvs_planejada_id === fvs?.id)
          .reduce((acc: any, b: any) => ({
            escopo: acc.escopo + Number(b.escopo_atribuido ?? 0),
            aprovado: acc.aprovado + Number(b.aprovado ?? 0),
            medido: acc.medido + Number(b.medido ?? 0),
            bloqueado: acc.bloqueado + Number(b.bloqueado ?? 0),
            disponivel: acc.disponivel + Number(b.disponivel ?? 0),
            valorDisponivel: acc.valorDisponivel + Number(b.valor_disponivel ?? 0),
          }), { escopo: 0, aprovado: 0, medido: 0, bloqueado: 0, disponivel: 0, valorDisponivel: 0 });

        return {
          fvsId: fvs?.id ?? c.fvs_planejada_id,
          ambienteId: fvs?.ambiente_id ?? '',
          subservico: fvs?.subservico ?? 'Serviço',
          ambienteNome: fvs?.ambientes?.nome ?? ambienteNames.get(fvs?.ambiente_id) ?? '',
          metodo: c.metodo,
          unidade: c.unidade,
          quantidadeTotal: Number(c.quantidade_total ?? 0),
          precoUnitario: c.preco_unitario == null ? null : Number(c.preco_unitario),
          empreiteiro: links.map((l: any) => teamNames.get(l.equipe_id)).filter(Boolean).join(', ') || null,
          dataInicio: links.length ? links.map((l: any) => l.data_inicio).sort()[0] : null,
          ...sums,
        };
      });

      medicoesServices.sort((a: any, b: any) =>
        (a.ambienteNome ?? '').localeCompare(b.ambienteNome ?? '') || (a.subservico ?? '').localeCompare(b.subservico ?? '')
      );
    }
  }

  // 2. Todas as equipes ativas (sem filtro de empresa — igual à tela de Equipes)
  const { data: allEquipes } = await supabase
    .from('equipes' as any)
    .select('id, nome, tipo, especialidade, escopo, equipe_empresas!equipe_empresas_equipe_id_fkey(empresa_id)')
    .eq('ativo', true)
    .order('nome');

  const allEquipesList: any[] = ((allEquipes as any[]) ?? []).filter((e: any) =>
    e.escopo === 'global' || (e.equipe_empresas ?? []).some((scope: any) => scope.empresa_id === typedObra.empresa_id)
  );
  const availableFvs = ((fvsPadrao as any[]) ?? []).filter((f: any) =>
    f.escopo === 'global' || (f.fvs_padrao_empresas ?? []).some((scope: any) => scope.empresa_id === typedObra.empresa_id)
  );

  // Separar equipes vinculadas das disponíveis
  const obraEquipes: any[]     = allEquipesList.filter((e: any) => linkedIds.includes(e.id));
  const availableEquipes: any[] = allEquipesList.filter((e: any) => !linkedIds.includes(e.id));

  const typedKpi = kpi as any;
  const totalFvs = Number(typedKpi?.total_fvs ?? 0);
  const progressoFvs = totalFvs > 0 ? Math.round((Number(typedKpi?.fvs_concluidas ?? 0) / totalFvs) * 100) : 0;

  return (
    <>
      <Header
        breadcrumbs={[
          { label: 'Obras', href: '/obras' },
          { label: typedObra.nome }
        ]}
      />

      <div className="prumo-page">
        <div className="prumo-page-inner">
        <PageHeader
          title={typedObra.nome}
          description={`${empresaNome} · ${typedObra.endereco || typedObra.municipio}${typedObra.uf ? `-${typedObra.uf}` : ''}${typedObra.eng_responsavel ? ` · ${typedObra.eng_responsavel}${typedObra.crea_cau ? ` (${typedObra.crea_cau})` : ''}` : ''}`}
          actions={<StatusBadge status={typedObra.status} />}
        />

        {/* Ficha resumida: os dados que respondem "que obra é esta" sem abrir nada. */}
        <div className="prumo-panel flex flex-col overflow-hidden lg:flex-row">
          {[
            {
              rotulo: 'Engenheiro responsável',
              valor: typedObra.eng_responsavel || '—',
              apoio: typedObra.crea_cau || 'sem CREA/CAU informado',
            },
            {
              rotulo: 'Prazo',
              valor: formatarData(typedObra.data_inicio_prev) || '—',
              apoio: typedObra.data_termino_prev ? `término previsto ${formatarData(typedObra.data_termino_prev)}` : 'sem término previsto',
            },
            {
              rotulo: 'Empresa',
              valor: empresaNome || '—',
              apoio: `${typedObra.municipio || 'Local não informado'}${typedObra.uf ? `-${typedObra.uf}` : ''}`,
            },
          ].map(campo => (
            <div key={campo.rotulo} className="flex-1 border-b border-brd-0 px-[18px] py-3.5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-txt-3">{campo.rotulo}</div>
              <div className="mt-1.5 truncate text-sm font-medium text-txt">{campo.valor}</div>
              <div className="mt-0.5 truncate text-[11.5px] text-txt-3">{campo.apoio}</div>
            </div>
          ))}
          <div className="w-full shrink-0 px-[18px] py-3.5 lg:w-[300px] lg:border-l lg:border-brd-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-txt-3">Progresso das FVS</div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <ProgressBar value={progressoFvs} variant={progressoFvs === 100 ? 'ok' : 'brand'} />
              <span className="prumo-metric shrink-0 text-[15px] font-semibold text-txt">{progressoFvs}%</span>
            </div>
            <div className="mt-1 text-[11.5px] text-txt-3">
              {typedKpi?.fvs_concluidas || 0} de {typedKpi?.total_fvs || 0} fichas conformes
            </div>
          </div>
        </div>

        {/* Trilha do fluxo: cada etapa alimenta a seguinte. */}
        <div>
          <h2 className="prumo-section-title mb-3">
            <span>Fluxo da obra</span>
          </h2>
          <div className="flex flex-wrap items-stretch gap-2">
            {[
              { rotulo: 'Ambientes', valor: typedKpi?.total_ambientes || 0, apoio: 'onde a inspeção acontece', cor: 'text-[var(--br)]' },
              { rotulo: 'FVS planejadas', valor: typedKpi?.total_fvs || 0, apoio: 'fichas associadas', cor: 'text-[var(--br)]' },
              { rotulo: 'Conformes', valor: typedKpi?.fvs_concluidas || 0, apoio: 'liberam medição', cor: 'text-ok' },
              { rotulo: 'NC abertas', valor: typedKpi?.ncs_abertas || 0, apoio: 'em tratativa', cor: 'text-nok', href: '/nc' },
            ].map((etapa, idx, todas) => {
              const conteudo = (
                <>
                  <div className="text-[12.5px] font-semibold text-txt">{etapa.rotulo}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className={`prumo-metric text-[22px] font-semibold leading-none ${etapa.cor}`}>{etapa.valor}</span>
                    <span className="truncate text-[11.5px] text-txt-3">{etapa.apoio}</span>
                  </div>
                </>
              );
              return (
                <div key={etapa.rotulo} className="flex min-w-[190px] flex-1 items-center gap-2">
                  {etapa.href ? (
                    <Link href={etapa.href} className="prumo-panel flex-1 px-4 py-3.5 transition-shadow hover:shadow-float">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="prumo-panel flex-1 px-4 py-3.5">{conteudo}</div>
                  )}
                  {idx < todas.length - 1 ? <ArrowRight size={16} className="shrink-0 text-txt-3" aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        </div>

        <ObraDetailClient
          obraId={typedObra.id}
          obra={typedObra}
          empresas={(empresas as any[] | null) || []}
          initialAmbientes={ambientes || []}
          ambientesWithVerificacoes={ambientesWithVerificacoes}
          medicoesServices={medicoesServices}
          fvsPadraoList={availableFvs}
          obraEquipes={obraEquipes}
          availableEquipes={availableEquipes}
          totalEmpresaEquipes={allEquipesList.length}
          totalUsuariosVinculados={totalUsuariosVinculados ?? 0}
          canDelete={authContext?.perfil === 'admin'}
        />
        </div>
      </div>
    </>
  );
}
