import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/context';
import { notFound } from '@/lib/compat/navigation';
import Link from '@/lib/compat/link';
import { CalendarDays, HardHat, Landmark, MapPin } from '@/components/icons';
import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
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
        <PageHeader title={typedObra.nome}>
          {/* Ficha em etiquetas: os dados que respondem "que obra é esta" sem abrir nada. */}
          <div className="mt-3.5 flex flex-wrap gap-2">
            <StatusBadge status={typedObra.status} size="md" />
            {empresaNome ? (
              <span className="prumo-pill h-[30px] bg-bg-1 px-3 text-[13px] font-semibold text-txt">
                <Landmark size={15} /> {empresaNome}
              </span>
            ) : null}
            {typedObra.municipio || typedObra.endereco ? (
              <span className="prumo-pill h-[30px] bg-bg-1 px-3 text-[13px] font-semibold text-txt">
                <MapPin size={15} /> {typedObra.municipio || typedObra.endereco}{typedObra.uf ? `-${typedObra.uf}` : ''}
              </span>
            ) : null}
            {typedObra.eng_responsavel ? (
              <span className="prumo-pill h-[30px] bg-bg-1 px-3 text-[13px] font-semibold text-txt">
                <HardHat size={15} /> {typedObra.eng_responsavel}
                {typedObra.crea_cau ? <span className="prumo-metric text-xs font-medium text-txt-2">{typedObra.crea_cau}</span> : null}
              </span>
            ) : null}
            {typedObra.data_inicio_prev || typedObra.data_termino_prev ? (
              <span className="prumo-pill h-[30px] bg-bg-1 px-3 text-[13px] font-semibold text-txt">
                <CalendarDays size={15} />
                <span className="prumo-metric text-xs">
                  {formatarData(typedObra.data_inicio_prev) || '—'} → {formatarData(typedObra.data_termino_prev) || '—'}
                </span>
              </span>
            ) : null}
          </div>
        </PageHeader>

        {/* Resumo em grafite: avanço das FVS em trena e o fluxo da obra em ladrilhos. */}
        <section aria-label="Resumo da obra" className="on-brand flex flex-wrap items-center gap-7 rounded-2xl bg-sidebar px-7 py-6 text-white">
          <div className="flex min-w-[280px] flex-[2_1_380px] flex-col gap-3.5">
            <div className="flex items-baseline gap-3.5">
              <span className="prumo-metric text-[48px] font-bold leading-none tracking-[-0.02em]">{progressoFvs}%</span>
              <span className="text-[15px] text-on-brand">das FVS conformes</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-brand-line">
              <div className="prumo-tape-on-dark h-full rounded-full" style={{ width: `${progressoFvs}%` }} />
            </div>
            <span className="prumo-metric text-xs text-on-brand">
              {typedKpi?.fvs_concluidas || 0} de {typedKpi?.total_fvs || 0} FVS · {typedKpi?.total_ambientes || 0} ambientes
            </span>
          </div>
          <div className="grid min-w-0 flex-[3_1_420px] grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { rotulo: 'Ambientes', valor: typedKpi?.total_ambientes || 0, ponto: null },
              { rotulo: 'FVS planejadas', valor: typedKpi?.total_fvs || 0, ponto: null },
              { rotulo: 'Conformes', valor: typedKpi?.fvs_concluidas || 0, ponto: 'bg-[#4CC06E]' },
              { rotulo: 'NCs abertas', valor: typedKpi?.ncs_abertas || 0, ponto: 'bg-[#FF6B5E]', href: '/nc' },
            ].map(etapa => {
              const conteudo = (
                <>
                  <span className="text-xs font-semibold text-on-brand">{etapa.rotulo}</span>
                  <span className="prumo-metric flex items-center gap-2 text-[26px] font-bold leading-none">
                    {etapa.ponto ? <span className={`h-2 w-2 rounded-full ${etapa.ponto}`} aria-hidden="true" /> : null}
                    {etapa.valor}
                  </span>
                </>
              );
              return etapa.href ? (
                <Link key={etapa.rotulo} href={etapa.href} className="flex flex-col gap-2 rounded-[22px] bg-[#26292D] p-4 transition-colors hover:bg-[#30343A]">
                  {conteudo}
                </Link>
              ) : (
                <div key={etapa.rotulo} className="flex flex-col gap-2 rounded-[22px] bg-[#26292D] p-4">{conteudo}</div>
              );
            })}
          </div>
        </section>

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
