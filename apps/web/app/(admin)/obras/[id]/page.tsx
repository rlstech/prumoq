import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import StatusBadge from '@/components/ui/StatusBadge';
import ObraDetailClient from './ObraDetailClient';

export default async function ObraDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const supabase = await createClient();

  const [
    { data: obra },
    { data: kpi },
    { data: ambientes },
    { data: fvsPadrao },
  ] = await Promise.all([
    supabase.from('obras' as never).select('*, empresas(nome)').eq('id', id).single(),
    (supabase.rpc as any)('get_obra_kpi', { p_obra_id: id }).single(),
    (supabase.rpc as any)('get_ambientes_obra', { p_obra_id: id }),
    supabase.from('fvs_padrao' as never).select('id, nome, revisao_atual, categoria').eq('ativo', true),
  ]);

  const typedObra = obra as any;
  if (!typedObra) return notFound();

  // 1. IDs das equipes já vinculadas a esta obra
  const { data: obraEquipesLinks } = await supabase
    .from('obra_equipes' as never)
    .select('equipe_id')
    .eq('obra_id', id);

  const linkedIds: string[] = ((obraEquipesLinks as any[]) ?? []).map((r: any) => r.equipe_id).filter(Boolean);

  // 2. Detalhes de TODAS as equipes da empresa
  const { data: allEquipes } = await supabase
    .from('equipes' as never)
    .select('id, nome, tipo, especialidade')
    .eq('empresa_id', typedObra.empresa_id)
    .eq('ativo', true);

  const allEquipesList: any[] = (allEquipes as any[]) ?? [];

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
        actions={
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-bg-0 border border-brd-1 rounded-lg text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors">
              Editar obra
            </button>
          </div>
        }
      />

      <div className="max-w-[1200px] mx-auto space-y-5 mt-6 px-6 pb-12">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-txt tracking-tight">{typedObra.nome}</h1>
            <StatusBadge status={typedObra.status} />
          </div>
          <p className="text-[13px] text-txt-2">
            {typedObra.empresas?.nome} · {typedObra.endereco || typedObra.municipio}{typedObra.uf ? `-${typedObra.uf}` : ''}
            {typedObra.engenheiro_nome && <> · {typedObra.engenheiro_nome}{typedObra.engenheiro_crea ? ` (${typedObra.engenheiro_crea})` : ''}</>}
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
          initialAmbientes={ambientes || []}
          fvsPadraoList={fvsPadrao || []}
          obraEquipes={obraEquipes}
          availableEquipes={availableEquipes}
        />
      </div>
    </>
  );
}
