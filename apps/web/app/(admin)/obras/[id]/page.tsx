import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/context';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import StatusBadge from '@/components/ui/StatusBadge';
import ObraDetailClient from './ObraDetailClient';

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
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-txt tracking-tight">{typedObra.nome}</h1>
            <StatusBadge status={typedObra.status} />
          </div>
          <p className="text-[13px] text-txt-2">
            {empresaNome} · {typedObra.endereco || typedObra.municipio}{typedObra.uf ? `-${typedObra.uf}` : ''}
            {typedObra.eng_responsavel && <> · {typedObra.eng_responsavel}{typedObra.crea_cau ? ` (${typedObra.crea_cau})` : ''}</>}
          </p>
        </div>

        {/* KPIs com border-left */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-[var(--br)] rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-[var(--br)]">{typedKpi?.total_ambientes || 0}</div>
            <div className="text-xs text-txt-2">Ambientes</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-pg rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-pg">{typedKpi?.total_fvs || 0}</div>
            <div className="text-xs text-txt-2">FVS planejadas</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-ok rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-ok">{typedKpi?.fvs_concluidas || 0}</div>
            <div className="text-xs text-txt-2">Concluídas</div>
          </div>
          <div className="bg-bg-1 border border-brd-0 border-l-[3px] border-l-nok rounded-xl p-[14px_16px]">
            <div className="text-2xl font-semibold text-nok">{typedKpi?.ncs_abertas || 0}</div>
            <div className="text-xs text-txt-2">NC abertas</div>
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
