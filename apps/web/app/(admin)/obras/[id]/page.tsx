import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import StatusBadge from '@/components/ui/StatusBadge';
import ObraDetailClient from './ObraDetailClient';

// Admin client bypasses RLS — safe in Server Components
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ObraDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const supabase = await createClient();

  const [
    { data: obra },
    { data: kpi },
    { data: ambientes },
    { data: fvsPadrao },
    { data: empresas },
  ] = await Promise.all([
    supabaseAdmin.from('obras' as any).select('*').eq('id', id).single(),
    (supabase.rpc as any)('get_obra_kpi', { p_obra_id: id }).single(),
    (supabaseAdmin.rpc as any)('get_ambientes_obra', { p_obra_id: id }),
    supabaseAdmin.from('fvs_padrao' as any).select('id, nome, revisao_atual, categoria').eq('ativo', true),
    supabaseAdmin.from('empresas').select('id, nome').eq('ativo', true),
  ]);

  const typedObra = obra as any;
  if (!typedObra) return notFound();

  const empresasList: any[] = (empresas as any[] | null) ?? [];
  const empresaNome = empresasList.find((e: any) => e.id === typedObra.empresa_id)?.nome ?? '';

  // 1. IDs das equipes já vinculadas a esta obra
  const { data: obraEquipesLinks } = await supabaseAdmin
    .from('obra_equipes' as any)
    .select('equipe_id')
    .eq('obra_id', id);

  const linkedIds: string[] = ((obraEquipesLinks as any[]) ?? []).map((r: any) => r.equipe_id).filter(Boolean);

  // 2. Todas as equipes ativas (sem filtro de empresa — igual à tela de Equipes)
  const { data: allEquipes } = await supabaseAdmin
    .from('equipes' as any)
    .select('id, nome, tipo, especialidade')
    .eq('ativo', true)
    .order('nome');

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
      />

      <div className="max-w-[1200px] mx-auto space-y-5 mt-6 px-6 pb-12">
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
          fvsPadraoList={fvsPadrao || []}
          obraEquipes={obraEquipes}
          availableEquipes={availableEquipes}
          totalEmpresaEquipes={allEquipesList.length}
        />
      </div>
    </>
  );
}
