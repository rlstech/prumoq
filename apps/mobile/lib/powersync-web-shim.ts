/**
 * PowerSync web shim
 * Replaces @powersync/react-native on the web platform.
 * Exports the same interface used by all screens, backed by Supabase REST.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { createEvidenceThumbnail } from './image-normalizer';
import { supabase } from './supabase';

interface DynamicResult {
  error: { message: string } | null;
}

interface DynamicFilter extends PromiseLike<DynamicResult> {
  eq(column: string, value: unknown): DynamicFilter;
}

interface DynamicTable {
  update(values: Record<string, unknown>): DynamicFilter;
  insert(values: Record<string, unknown>): PromiseLike<DynamicResult>;
}

function dynamicTable(name: string): DynamicTable {
  const from = supabase.from as unknown as (relation: string) => DynamicTable;
  return from.call(supabase, name);
}

// ─────────────────────────────────────────────────────────
// PowerSyncContext (no-op on web — screens don't read it)
// ─────────────────────────────────────────────────────────
export const PowerSyncContext = createContext<null>(null);

// ─────────────────────────────────────────────────────────
// Reactive write notifications
// Cada db.execute bem-sucedido incrementa _writeVersion,
// forçando todos os useQuery ativos a re-buscar dados.
// ─────────────────────────────────────────────────────────
let _writeVersion = 0;
const _writeListeners = new Set<() => void>();
function notifyWriteListeners() {
  _writeVersion++;
  _writeListeners.forEach(fn => fn());
}

// ─────────────────────────────────────────────────────────
// useQuery — maps SQL patterns to Supabase queries
// ─────────────────────────────────────────────────────────
interface WebQueryResult<T> {
  data: T[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | undefined;
}

export function useQuery<T>(sql: string, params?: unknown[]): WebQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    const listener = () => setVersion(v => v + 1);
    _writeListeners.add(listener);
    return () => { _writeListeners.delete(listener); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    setError(undefined);
    fetchFromSupabase<T>(sql, params ?? [])
      .then(rows => {
        if (!cancelled) setData(rows);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsFetching(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, JSON.stringify(params ?? []), version]);

  return { data, isLoading, isFetching, error };
}

// Alias
export const usePowerSyncQuery = useQuery;

// ─────────────────────────────────────────────────────────
// db — web replacement for PowerSyncDatabase
// ─────────────────────────────────────────────────────────
export const db = {
  async init() { /* no-op */ },
  async connect(_connector: unknown) { /* no-op */ },
  async disconnectAndClear() {
    await supabase.auth.signOut();
  },
  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await executeOnSupabase(sql, params);
    notifyWriteListeners();
  },
};

// ─────────────────────────────────────────────────────────
// User access cache — which obras the current user can see
// Always explicit IDs. RLS still enforces the tenant boundary server-side.
// ─────────────────────────────────────────────────────────
let _obraIdsCache: { ids: string[] | null; ts: number } | null = null;

let _obraIdsFlight: Promise<string[] | null> | null = null;

async function getAllowedObraIds(): Promise<string[] | null> {
  if (_obraIdsCache && Date.now() - _obraIdsCache.ts < 30_000) return _obraIdsCache.ids;
  if (_obraIdsFlight) return _obraIdsFlight;
  _obraIdsFlight = _fetchAllowedObraIds().finally(() => { _obraIdsFlight = null; });
  return _obraIdsFlight;
}

async function _fetchAllowedObraIds(): Promise<string[] | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) { _obraIdsCache = { ids: [], ts: Date.now() }; return []; }
  const { data: u } = await supabase.from('usuarios').select('perfil').eq('id', user.id).single();
  if ((u as any)?.perfil === 'admin') {
    const { data: tenantObras } = await supabase.from('obras').select('id').eq('ativo', true);
    const ids = (tenantObras ?? []).map(obra => obra.id);
    _obraIdsCache = { ids, ts: Date.now() };
    return ids;
  }
  const { data: ou } = await supabase.from('obra_usuarios').select('obra_id').eq('usuario_id', user.id);
  const ids = (ou ?? []).map((r: any) => r.obra_id as string);
  _obraIdsCache = { ids, ts: Date.now() };
  return ids;
}

function filterByObraId<T>(rows: T[], field: keyof T, ids: string[] | null): T[] {
  if (ids === null) return rows;
  return rows.filter(r => ids.includes(r[field] as unknown as string));
}

function nestedRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? first as Record<string, unknown> : {};
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

// ─────────────────────────────────────────────────────────
// SQL → Supabase dispatch
// ─────────────────────────────────────────────────────────
async function fetchFromSupabase<T>(sql: string, params: unknown[]): Promise<T[]> {
  const s = sql.trim().toLowerCase().replace(/\s+/g, ' ');

  if (s === 'select 1 where 0') return [];

  // Gestores disponíveis para atribuição da análise financeira de NC.
  if (s.includes('from usuarios') && s.includes("perfil in ('admin','gestor')")) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome')
      .in('perfil', ['admin', 'gestor'])
      .order('nome');
    if (error) throw new Error(`Erro ao carregar gestores: ${error.message}`);
    return (data ?? []) as T[];
  }

  // ── usuarios ──────────────────────────────────────────
  if (s.includes('from usuarios') && !s.includes('join')) {
    const userId = params[0];
    if (!s.includes('where id = ?') || typeof userId !== 'string' || !userId) {
      throw new Error('Consulta de usuário sem o ID autenticado.');
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, cargo, perfil, cliente_id, assinatura_padrao_url, assinatura_padrao_atualizada_em')
      .eq('id', userId)
      .limit(1);

    if (error) {
      throw new Error(`Erro ao carregar usuário autenticado: ${error.message}`);
    }
    if (!data?.length) {
      throw new Error('Perfil do usuário autenticado não encontrado.');
    }
    return data as T[];
  }

  // ── obras ativas (obras list screen) ──────────────────
  // Flags efetivas da obra. No PWA, boolean é normalizado para 0/1 como no SQLite.
  if (s.includes('controle_medicoes_efetivo') && s.includes('controle_financeiro_nc_efetivo') && s.includes('from obras')) {
    const obraId = params[0];
    if (typeof obraId !== 'string') throw new Error('Obra inválida ao carregar recursos opcionais.');
    const { data, error } = await supabase
      .from('obras')
      .select('controle_medicoes_efetivo, controle_financeiro_nc_efetivo')
      .eq('id', obraId)
      .maybeSingle();
    if (error) throw new Error(`Erro ao carregar recursos da obra: ${error.message}`);
    if (!data) return [];
    return [{
      controle_medicoes_efetivo: data.controle_medicoes_efetivo ? 1 : 0,
      controle_financeiro_nc_efetivo: data.controle_financeiro_nc_efetivo ? 1 : 0,
    }] as T[];
  }

  // Escopo ativo e último avanço acumulado usados pela verificação de campo.
  if (s.includes('from vinculos_execucao_servico v') && s.includes('avancos_aprovados_servico aa')) {
    const fvsId = params[0];
    if (typeof fvsId !== 'string') throw new Error('FVS inválida ao carregar o avanço físico.');

    const [{ data: links, error: linksError }, { data: config, error: configError }] = await Promise.all([
      supabase.from('vinculos_execucao_servico')
        .select('id, etapa_id, equipe_id, escopo_atribuido')
        .eq('fvs_planejada_id', fvsId)
        .eq('status', 'ativo'),
      supabase.from('fvs_medicao_configuracoes')
        .select('unidade')
        .eq('fvs_planejada_id', fvsId)
        .maybeSingle(),
    ]);
    if (linksError) throw new Error(`Erro ao carregar responsáveis da medição: ${linksError.message}`);
    if (configError) throw new Error(`Erro ao carregar configuração da medição: ${configError.message}`);
    if (!links?.length || !config) return [];

    const teamIds = [...new Set(links.map(link => link.equipe_id))];
    const stageIds = [...new Set(links.map(link => link.etapa_id).filter((stageId): stageId is string => stageId !== null))];
    const linkIds = links.map(link => link.id);
    const [{ data: teams, error: teamsError }, stageResult, { data: advances, error: advancesError }] = await Promise.all([
      supabase.from('equipes').select('id, nome').in('id', teamIds),
      stageIds.length
        ? supabase.from('fvs_medicao_etapas').select('id, nome, ordem, permite_avanco_parcial').in('id', stageIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('avancos_aprovados_servico')
        .select('vinculacao_id, executado_atual, aprovado_atual, data_aprovacao, created_at')
        .in('vinculacao_id', linkIds)
        .order('data_aprovacao', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    const { data: stages, error: stagesError } = stageResult;
    if (teamsError) throw new Error(`Erro ao carregar equipes da medição: ${teamsError.message}`);
    if (stagesError) throw new Error(`Erro ao carregar etapas da medição: ${stagesError.message}`);
    if (advancesError) throw new Error(`Erro ao carregar avanços aprovados: ${advancesError.message}`);

    const teamMap = new Map((teams ?? []).map(team => [team.id, team.nome]));
    const stageMap = new Map((stages ?? []).map(stage => [stage.id, stage]));
    const latestAdvance = new Map<string, { executado_atual: number; aprovado_atual: number }>();
    for (const advance of advances ?? []) {
      if (!latestAdvance.has(advance.vinculacao_id)) latestAdvance.set(advance.vinculacao_id, advance);
    }
    return links
      .map(link => {
        const stage = link.etapa_id ? stageMap.get(link.etapa_id) : undefined;
        const advance = latestAdvance.get(link.id);
        return {
          id: link.id,
          etapa_id: link.etapa_id,
          equipe_id: link.equipe_id,
          equipe_nome: teamMap.get(link.equipe_id) ?? 'Equipe',
          etapa_nome: stage?.nome ?? null,
          escopo_atribuido: String(link.escopo_atribuido),
          unidade: config.unidade,
          permite_avanco_parcial: stage ? (stage.permite_avanco_parcial ? 1 : 0) : 1,
          executado_atual: String(advance?.executado_atual ?? 0),
          aprovado_atual: String(advance?.aprovado_atual ?? 0),
          ordem: stage?.ordem ?? 0,
        };
      })
      .sort((left, right) => left.ordem - right.ordem) as T[];
  }

  if (s.includes('progresso_percentual') && s.includes('o.municipio') && s.includes('from obras o') && s.includes('where o.ativo = 1')) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_obras_com_fvs'), getAllowedObraIds()]);
    return filterByObraId((data ?? []) as T[], 'id' as keyof T, ids);
  }

  // ── obras ativas count ─────────────────────────────────
  if (s.includes('count(*)') && s.includes('from obras') && s.includes('ativo = 1') && !s.includes('join')) {
    const ids = await getAllowedObraIds();
    let q = supabase.from('obras').select('*', { count: 'exact', head: true }).eq('ativo', true);
    if (ids !== null && ids.length > 0) q = q.in('id', ids);
    else if (ids !== null && ids.length === 0) return [{ count: 0 }] as T[];
    const { count } = await q;
    return [{ count: count ?? 0 }] as T[];
  }

  // ── obras ativas lista simples (perfil) ───────────────
  if (s.includes('from obras o where o.ativo = 1') && s.includes('select o.id, o.nome')) {
    const [{ data }, ids] = await Promise.all([
      supabase.from('obras').select('id, nome, municipio, uf').eq('ativo', true).order('nome'),
      getAllowedObraIds()
    ]);
    return filterByObraId((data ?? []) as T[], 'id' as keyof T, ids);
  }

  // ── ncs abertas count (com ou sem joins de obra) ──────
  if ((s.includes("status = 'aberta'") || s.includes("status in ('aberta','em_correcao')")) && s.includes('count(*)') && s.includes('from nao_conformidades') && !s.includes('date(n.data_nova_verif)') && !s.includes('from ambientes') && !s.includes('from obras o')) {
    const [{ data: ncs }, ids] = await Promise.all([supabase.rpc('get_ncs_full'), getAllowedObraIds()]);
    const filtered = filterByObraId((ncs ?? []) as any[], 'obra_id', ids)
      .filter((n: any) => n.status === 'aberta' || n.status === 'em_correcao');
    return [{ count: filtered.length }] as T[];
  }

  // ── ncs vencendo hoje count ────────────────────────────
  if ((s.includes("status = 'aberta'") || s.includes("status in ('aberta','em_correcao')")) && s.includes('count(*)') && s.includes('date(') && s.includes('data_nova_verif')) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: ncs }, ids] = await Promise.all([supabase.rpc('get_ncs_full'), getAllowedObraIds()]);
    const filtered = filterByObraId((ncs ?? []) as any[], 'obra_id', ids)
      .filter((n: any) => (n.status === 'aberta' || n.status === 'em_correcao') && n.data_nova_verif?.slice(0, 10) === today);
    return [{ count: filtered.length }] as T[];
  }

  // ── verificações semana count ──────────────────────────
  if (s.includes('count(*)') && s.includes('from verificacoes') && s.includes('date(') && s.includes('data_verif') && !s.includes('inspetor_id')) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const wStr = weekAgo.toISOString().slice(0, 10);
    const [{ data: verifs }, ids] = await Promise.all([supabase.rpc('get_verificacoes_recentes'), getAllowedObraIds()]);
    // get_verificacoes_recentes is limited to 3; use direct query filtered by obra
    if (ids === null) {
      const { count } = await supabase.from('verificacoes').select('*', { count: 'exact', head: true }).gte('data_verif', wStr);
      return [{ count: count ?? 0 }] as T[];
    }
    if (ids.length === 0) return [{ count: 0 }] as T[];
    // get ambientes for allowed obras, then verificacoes
    const { data: ambientes } = await supabase.from('ambientes').select('id').in('obra_id', ids);
    const ambIds = (ambientes ?? []).map((a: any) => a.id as string);
    if (!ambIds.length) return [{ count: 0 }] as T[];
    const { data: fps } = await supabase.from('fvs_planejadas').select('id').in('ambiente_id', ambIds);
    const fpIds = (fps ?? []).map((f: any) => f.id as string);
    if (!fpIds.length) return [{ count: 0 }] as T[];
    const { count } = await supabase.from('verificacoes').select('*', { count: 'exact', head: true }).in('fvs_planejada_id', fpIds).gte('data_verif', wStr);
    return [{ count: count ?? 0 }] as T[];
  }

  // ── verificações total por inspetor ───────────────────
  if (s.includes('count(*)') && s.includes('from verificacoes') && s.includes('inspetor_id') && !s.includes("status = 'conforme'") && params[0]) {
    const { count } = await supabase.from('verificacoes').select('*', { count: 'exact', head: true }).eq('inspetor_id', params[0] as string);
    return [{ count: count ?? 0 }] as T[];
  }

  // ── verificações conformes por inspetor ───────────────
  if (s.includes('count(*)') && s.includes('from verificacoes') && s.includes('inspetor_id') && s.includes("status = 'conforme'") && params[0]) {
    const { count } = await supabase.from('verificacoes').select('*', { count: 'exact', head: true }).eq('inspetor_id', params[0] as string).eq('status', 'conforme');
    return [{ count: count ?? 0 }] as T[];
  }

  // ── ncs abertas por inspetor ──────────────────────────
  if (s.includes('from nao_conformidades n join verificacoes v') && s.includes('inspetor_id') && params[0]) {
    const { data } = await supabase.rpc('get_ncs_abertas_inspetor', { p_inspetor_id: params[0] as string });
    return [{ count: (data as { count: number }[])?.[0]?.count ?? 0 }] as T[];
  }

  // ── NCs urgentes (dashboard) ──────────────────────────
  if (s.includes('from nao_conformidades n') && s.includes('join verificacao_itens vi') && s.includes('order by n.data_nova_verif asc') && s.includes('limit 3')) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_ncs_full'), getAllowedObraIds()]);
    const filtered = filterByObraId((data ?? []) as any[], 'obra_id', ids)
      .filter((n: any) => n.status === 'aberta' || n.status === 'em_correcao')
      .sort((a: any, b: any) => (a.data_nova_verif ?? '').localeCompare(b.data_nova_verif ?? ''))
      .slice(0, 3);
    return filtered as T[];
  }

  // ── obras com progresso (dashboard) ───────────────────
  if (s.includes('progresso_percentual') && s.includes('from obras o') && s.includes('where o.ativo = 1') && s.includes('limit 3')) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_obras_com_fvs'), getAllowedObraIds()]);
    return filterByObraId((data ?? []) as T[], 'id' as keyof T, ids).slice(0, 3);
  }

  // ── verificações recentes (dashboard) ─────────────────
  if (s.includes('from verificacoes v') && s.includes('join fvs_planejadas fp') && s.includes('order by v.data_verif desc') && s.includes('limit 3')) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_verificacoes_recentes'), getAllowedObraIds()]);
    return filterByObraId((data ?? []) as T[], 'obra_id' as keyof T, ids).slice(0, 3);
  }

  // ── detalhe completo da NC ────────────────────────────
  if (
    s.includes('from nao_conformidades n')
    && s.includes('vi.metodo_verif as item_metodo')
    && s.includes('where n.id = ?')
    && params[0]
  ) {
    const ncId = params[0] as string;
    const { data: nc, error: ncError } = await supabase
      .from('nao_conformidades')
      .select('*')
      .eq('id', ncId)
      .maybeSingle();
    if (ncError) throw new Error(`Erro ao carregar a não conformidade: ${ncError.message}`);
    if (!nc) return [];

    const [{ data: item, error: itemError }, { data: verification, error: verificationError }] = await Promise.all([
      supabase
        .from('verificacao_itens')
        .select('id, titulo, metodo_verif, tolerancia, resultado')
        .eq('id', nc.verificacao_item_id)
        .maybeSingle(),
      supabase
        .from('verificacoes')
        .select('id, fvs_planejada_id, numero_verif, data_verif, inspetor_id, equipe_id')
        .eq('id', nc.verificacao_id)
        .maybeSingle(),
    ]);
    if (itemError) throw new Error(`Erro ao carregar o item da NC: ${itemError.message}`);
    if (verificationError) throw new Error(`Erro ao carregar a verificação da NC: ${verificationError.message}`);
    if (!item || !verification) return [];

    const { data: plannedFvs, error: fvsError } = await supabase
      .from('fvs_planejadas')
      .select('id, ambiente_id, subservico')
      .eq('id', verification.fvs_planejada_id)
      .maybeSingle();
    if (fvsError) throw new Error(`Erro ao carregar o serviço da NC: ${fvsError.message}`);
    if (!plannedFvs) return [];

    const { data: environment, error: environmentError } = await supabase
      .from('ambientes')
      .select('id, obra_id, nome')
      .eq('id', plannedFvs.ambiente_id)
      .maybeSingle();
    if (environmentError) throw new Error(`Erro ao carregar o ambiente da NC: ${environmentError.message}`);
    if (!environment) return [];

    const [{ data: work, error: workError }, allowedWorkIds] = await Promise.all([
      supabase
        .from('obras')
        .select('id, nome')
        .eq('id', environment.obra_id)
        .maybeSingle(),
      getAllowedObraIds(),
    ]);
    if (workError) throw new Error(`Erro ao carregar a obra da NC: ${workError.message}`);
    if (!work || (allowedWorkIds !== null && !allowedWorkIds.includes(work.id))) return [];

    const userPromise = verification.inspetor_id
      ? supabase
        .from('usuarios')
        .select('nome, cargo')
        .eq('id', verification.inspetor_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const executionTeamPromise = verification.equipe_id
      ? supabase
        .from('equipes')
        .select('nome')
        .eq('id', verification.equipe_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const responsibleTeamPromise = nc.responsavel_id
      ? supabase
        .from('equipes')
        .select('nome')
        .eq('id', nc.responsavel_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const [
      { data: inspector, error: inspectorError },
      { data: executionTeam, error: executionTeamError },
      { data: responsibleTeam, error: responsibleTeamError },
    ] = await Promise.all([userPromise, executionTeamPromise, responsibleTeamPromise]);
    if (inspectorError) throw new Error(`Erro ao carregar o inspetor da NC: ${inspectorError.message}`);
    if (executionTeamError) throw new Error(`Erro ao carregar a equipe da verificação: ${executionTeamError.message}`);
    if (responsibleTeamError) throw new Error(`Erro ao carregar o responsável da NC: ${responsibleTeamError.message}`);

    return [{
      ...nc,
      item_titulo: item.titulo,
      item_metodo: item.metodo_verif,
      item_tolerancia: item.tolerancia,
      item_resultado: item.resultado,
      numero_verif: verification.numero_verif,
      data_verif: verification.data_verif,
      inspetor_nome: inspector?.nome ?? null,
      inspetor_cargo: inspector?.cargo ?? null,
      equipe_nome: executionTeam?.nome ?? null,
      responsavel_nome: responsibleTeam?.nome ?? null,
      fvs_planejada_id: plannedFvs.id,
      subservico: plannedFvs.subservico,
      ambiente_id: environment.id,
      ambiente_nome: environment.nome,
      obra_id: work.id,
      obra_nome: work.nome,
    }] as T[];
  }

  // ── evidências de uma NC ──────────────────────────────
  if (
    s.includes('from nc_fotos nf')
    && s.includes('where nf.nc_id = ?')
    && !s.includes('join nao_conformidades')
    && params[0]
  ) {
    const { data, error } = await supabase
      .from('nc_fotos')
      .select('id, nc_id, r2_key, r2_thumb_key, nome_arquivo, ordem')
      .eq('nc_id', params[0] as string)
      .order('ordem');
    if (error) throw new Error(`Erro ao carregar as evidências da NC: ${error.message}`);
    return (data ?? []) as T[];
  }

  // ── histórico de reinspeções de uma NC ────────────────
  if (s.includes('from nc_reinspecoes nr') && s.includes('where nr.nc_id = ?') && params[0]) {
    const { data: reinspectionRows, error } = await supabase
      .from('nc_reinspecoes')
      .select('id, nc_id, verificacao_id, inspetor_id, resultado, observacao, foto_url, nova_nc_id, created_at')
      .eq('nc_id', params[0] as string)
      .order('created_at');
    if (error) throw new Error(`Erro ao carregar as reinspeções da NC: ${error.message}`);
    if (!reinspectionRows?.length) return [];

    const inspectorIds = [...new Set(reinspectionRows.map(row => row.inspetor_id))];
    const verificationIds = [...new Set(reinspectionRows.map(row => row.verificacao_id))];
    const [{ data: inspectors }, { data: verifications }] = await Promise.all([
      supabase.from('usuarios').select('id, nome').in('id', inspectorIds),
      supabase.from('verificacoes').select('id, numero_verif').in('id', verificationIds),
    ]);
    const inspectorsById = new Map((inspectors ?? []).map(row => [row.id, row.nome]));
    const verificationsById = new Map((verifications ?? []).map(row => [row.id, row.numero_verif]));

    return reinspectionRows.map(row => ({
      ...row,
      inspetor_nome: inspectorsById.get(row.inspetor_id) ?? null,
      numero_verif: verificationsById.get(row.verificacao_id) ?? null,
    })) as T[];
  }

  // ── encadeamento de ocorrências da NC ─────────────────
  if (
    s.includes('from nao_conformidades n')
    && s.includes('select n.id, n.numero_ocorrencia, n.status, n.descricao')
    && !s.includes('join')
    && params[0]
  ) {
    const baseQuery = supabase
      .from('nao_conformidades')
      .select('id, numero_ocorrencia, status, descricao');
    const { data, error } = s.includes('where n.nc_anterior_id = ?')
      ? await baseQuery
        .eq('nc_anterior_id', params[0] as string)
        .order('numero_ocorrencia')
      : await baseQuery.eq('id', params[0] as string);
    if (error) throw new Error(`Erro ao carregar as ocorrências relacionadas: ${error.message}`);
    return (data ?? []) as T[];
  }

  // ── lista NCs com joins (tela NC) ─────────────────────
  if (
    s.includes('from nao_conformidades n')
    && s.includes('join verificacao_itens vi')
    && s.includes('join obras o')
    && (
      s.includes("n.status in ('aberta', 'resolvida')")
      || s.includes("n.status != 'cancelada'")
    )
  ) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_ncs_full'), getAllowedObraIds()]);
    return filterByObraId((data ?? []) as T[], 'obra_id' as keyof T, ids);
  }

  // ── obra detalhe ──────────────────────────────────────
  if (s.includes('select id, nome, municipio, uf, eng_responsavel from obras where id = ?') || (s.includes('from obras') && s.includes('where id = ?') && !s.includes('join'))) {
    if (!params[0]) return [];
    const { data } = await supabase.from('obras').select('id, nome, municipio, uf, eng_responsavel').eq('id', params[0] as string);
    return (data ?? []) as T[];
  }

  // ── obra KPIs ─────────────────────────────────────────
  if (s.includes('count(distinct a.id) as total_ambientes') && s.includes('where o.id = ?') && params[0]) {
    const { data } = await supabase.rpc('get_obra_kpi', { p_obra_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── ambientes da obra com progresso ───────────────────
  if (s.includes('from ambientes a') && s.includes('count(distinct f.id) as total_fvs') && s.includes('where a.obra_id = ?') && params[0]) {
    const { data } = await supabase.rpc('get_ambientes_obra', { p_obra_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── detalhe ambiente ──────────────────────────────────
  if (s.includes('from ambientes a') && s.includes('join obras o') && s.includes('where a.id = ?') && params[0]) {
    const { data } = await supabase.from('ambientes').select('id, nome, tipo, localizacao, obras!ambientes_obra_id_fkey(nome)').eq('id', params[0] as string);
    const mapped = (data ?? []).map((a: Record<string, unknown>) => ({
      id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      localizacao: a.localizacao,
      obra_nome: (a.obras as Record<string, unknown>)?.nome ?? '',
    }));
    return mapped as T[];
  }

  // ── FVS da ambiente ───────────────────────────────────
  if (s.includes('from fvs_planejadas fp') && s.includes('where fp.ambiente_id = ?') && s.includes('count(v.id)') && params[0]) {
    const { data } = await supabase.rpc('get_fvs_ambiente', { p_ambiente_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── gestores/admins da obra (FVSReopenModal autorizado_por) ──
  if (s.includes('from usuarios u') && s.includes('join obra_usuarios') && s.includes('perfil in') && params[0]) {
    const { data: ouRows } = await supabase
      .from('obra_usuarios')
      .select('usuario_id')
      .eq('obra_id', params[0] as string)
      .eq('ativo', true);
    const userIds = (ouRows ?? []).map((r: any) => r.usuario_id as string);
    if (!userIds.length) return [] as T[];
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, perfil')
      .in('id', userIds)
      .in('perfil', ['gestor', 'admin']);
    return (data ?? []) as T[];
  }

  // ── última conclusão da FVS ───────────────────────────
  if (s.includes('from fvs_conclusoes fc') && s.includes('join usuarios u') && s.includes('where fc.fvs_planejada_id = ?') && params[0]) {
    const { data } = await supabase
      .from('fvs_conclusoes')
      .select('id, percentual_final, resultado, observacao_final, motivo_antes_100, created_at, usuarios!inspetor_id(nome)')
      .eq('fvs_planejada_id', params[0] as string)
      .order('numero_conclusao', { ascending: false })
      .limit(1);
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      percentual_final: r.percentual_final,
      resultado: r.resultado,
      observacao_final: r.observacao_final,
      motivo_antes_100: r.motivo_antes_100,
      created_at: r.created_at,
      inspetor_nome: (r.usuarios as Record<string, unknown>)?.nome ?? '',
    }));
    return mapped as T[];
  }

  // ── registro completo: cabeçalho da verificação ───────
  if (s.includes('from verificacoes v') && s.includes('where v.id = ? and v.fvs_planejada_id = ?') && params[0] && params[1]) {
    const { data, error } = await supabase
      .from('verificacoes')
      .select(`
        id, fvs_planejada_id, numero_verif, inspetor_id, equipe_id,
        data_verif, percentual_exec, status, observacoes, assinatura_url,
        assinada_em, created_offline, created_at,
        usuarios!inspetor_id(nome, cargo),
        equipes!verificacoes_equipe_id_fkey(nome, tipo, responsavel, especialidade),
        fvs_planejadas!verificacoes_fvs_planejada_id_fkey!inner(
          subservico,
          ambientes!fvs_planejadas_ambiente_id_fkey!inner(
            nome,
            obras!ambientes_obra_id_fkey!inner(nome, eng_responsavel, crea_cau)
          )
        )
      `)
      .eq('id', params[0] as string)
      .eq('fvs_planejada_id', params[1] as string)
      .limit(1);
    if (error) throw new Error(`Erro ao carregar verificação: ${error.message}`);

    const mapped = (data ?? []).map(row => {
      const source = row as unknown as Record<string, unknown>;
      const usuario = nestedRecord(source.usuarios);
      const equipe = nestedRecord(source.equipes);
      const fvs = nestedRecord(source.fvs_planejadas);
      const ambiente = nestedRecord(fvs.ambientes);
      const obra = nestedRecord(ambiente.obras);

      return {
        id: source.id,
        fvs_planejada_id: source.fvs_planejada_id,
        numero_verif: source.numero_verif,
        inspetor_id: source.inspetor_id,
        equipe_id: source.equipe_id,
        data_verif: source.data_verif,
        percentual_exec: source.percentual_exec,
        status: source.status,
        observacoes: source.observacoes,
        assinatura_url: source.assinatura_url,
        assinada_em: source.assinada_em,
        created_offline: source.created_offline,
        created_at: source.created_at,
        inspetor_nome: usuario.nome ?? null,
        inspetor_cargo: usuario.cargo ?? null,
        equipe_nome: equipe.nome ?? null,
        equipe_tipo: equipe.tipo ?? null,
        equipe_responsavel: equipe.responsavel ?? null,
        equipe_especialidade: equipe.especialidade ?? null,
        subservico: fvs.subservico ?? null,
        ambiente_nome: ambiente.nome ?? null,
        obra_nome: obra.nome ?? null,
        eng_responsavel: obra.eng_responsavel ?? null,
        crea_cau: obra.crea_cau ?? null,
      };
    });
    return mapped as T[];
  }

  // ── registro completo: itens do checklist ─────────────
  if (s.includes('from verificacao_itens vi') && s.includes('where vi.verificacao_id = ?') && !s.includes('join verificacoes') && params[0]) {
    const { data, error } = await supabase
      .from('verificacao_itens')
      .select('id, verificacao_id, fvs_padrao_item_id, ordem, titulo, metodo_verif, tolerancia, resultado')
      .eq('verificacao_id', params[0] as string)
      .order('ordem');
    if (error) throw new Error(`Erro ao carregar itens da verificação: ${error.message}`);
    return (data ?? []) as T[];
  }

  // ── registro completo: não conformidades ──────────────
  if (s.includes('from nao_conformidades n') && s.includes('where n.verificacao_id = ?') && !s.includes('join verificacao_itens') && params[0]) {
    const { data, error } = await supabase
      .from('nao_conformidades')
      .select(`
        id, verificacao_id, verificacao_item_id, descricao, solucao_proposta,
        responsavel_id, data_nova_verif, prioridade, status,
        resolvida_na_verif_id, resolvida_em, observacao_resolucao,
        equipes(nome)
      `)
      .eq('verificacao_id', params[0] as string);
    if (error) throw new Error(`Erro ao carregar não conformidades: ${error.message}`);

    const mapped = (data ?? []).map(row => {
      const source = row as unknown as Record<string, unknown>;
      const equipe = nestedRecord(source.equipes);
      return {
        id: source.id,
        verificacao_id: source.verificacao_id,
        verificacao_item_id: source.verificacao_item_id,
        descricao: source.descricao,
        solucao_proposta: source.solucao_proposta,
        responsavel_id: source.responsavel_id,
        data_nova_verif: source.data_nova_verif,
        prioridade: source.prioridade,
        status: source.status,
        resolvida_na_verif_id: source.resolvida_na_verif_id,
        resolvida_em: source.resolvida_em,
        observacao_resolucao: source.observacao_resolucao,
        responsavel_nome: equipe.nome ?? null,
      };
    });
    return mapped as T[];
  }

  // ── registro completo: fotos gerais ────────────────────
  if (s.includes('from verificacao_fotos vf') && s.includes('where vf.verificacao_id = ?') && params[0]) {
    const { data, error } = await supabase
      .from('verificacao_fotos')
      .select('id, verificacao_id, r2_key, r2_thumb_key, nome_arquivo, ordem')
      .eq('verificacao_id', params[0] as string)
      .order('ordem');
    if (error) throw new Error(`Erro ao carregar fotos da verificação: ${error.message}`);
    return (data ?? []) as T[];
  }

  // ── registro completo: fotos das NCs ───────────────────
  if (s.includes('from nc_fotos nf') && s.includes('join nao_conformidades n') && s.includes('where n.verificacao_id = ?') && params[0]) {
    const { data: ncs, error: ncError } = await supabase
      .from('nao_conformidades')
      .select('id')
      .eq('verificacao_id', params[0] as string);
    if (ncError) throw new Error(`Erro ao localizar evidências das NCs: ${ncError.message}`);

    const ncIds = (ncs ?? []).map(row => row.id);
    if (ncIds.length === 0) return [];

    const { data, error } = await supabase
      .from('nc_fotos')
      .select('id, nc_id, r2_key, r2_thumb_key, ordem')
      .in('nc_id', ncIds)
      .order('ordem');
    if (error) throw new Error(`Erro ao carregar evidências das NCs: ${error.message}`);
    return (data ?? []) as T[];
  }

  // ── FVS detalhe ───────────────────────────────────────
  if (s.includes('from fvs_planejadas fp') && s.includes('join ambientes a') && s.includes('where fp.id = ?') && params[0]) {
    const { data } = await supabase.rpc('get_fvs_detalhe', { p_fvs_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── verificações do FVS ───────────────────────────────
  if (s.includes('from verificacoes v') && s.includes('left join usuarios u') && s.includes('where v.fvs_planejada_id = ?') && params[0]) {
    const { data } = await supabase.rpc('get_verificacoes_fvs', { p_fvs_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── NCs do FVS ────────────────────────────────────────
  if (s.includes('from nao_conformidades n') && s.includes('join verificacao_itens vi') && s.includes('n.verificacao_id in') && s.includes('fvs_planejada_id = ?') && params[0]) {
    const { data } = await supabase.rpc('get_ncs_fvs', { p_fvs_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── fotos do FVS ──────────────────────────────────────
  if (s.includes('from verificacao_fotos') && s.includes('verificacao_id in') && s.includes('fvs_planejada_id = ?') && params[0]) {
    const { data } = await supabase.rpc('get_fotos_fvs', { p_fvs_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── nova verificação: FVS planejada ───────────────────
  if (s.includes('select id, subservico, revisao_associada from fvs_planejadas where id = ?') && params[0]) {
    const { data } = await supabase.from('fvs_planejadas').select('id, subservico, revisao_associada').eq('id', params[0] as string);
    return (data ?? []) as T[];
  }

  // ── nova verificação: itens do checklist ──────────────
  if (s.includes('from fvs_padrao_itens fpi') && s.includes('join fvs_planejadas fp') && params[0]) {
    const { data } = await supabase.rpc('get_itens_checklist', { p_fvs_id: params[0] as string });
    return (data ?? []) as T[];
  }

  // ── nova verificação: equipes da obra ────────────────
  if (s.includes('from equipes e') && s.includes('join obra_equipes oe') && s.includes('oe.obra_id = ?') && params[0]) {
    const { data: oeRows } = await supabase
      .from('obra_equipes')
      .select('equipe_id')
      .eq('obra_id', params[0] as string);
    const equipeIds = (oeRows ?? []).map(r => r.equipe_id);
    if (equipeIds.length === 0) return [] as T[];
    const { data } = await supabase
      .from('equipes')
      .select('id, nome, tipo')
      .in('id', equipeIds)
      .eq('ativo', true)
      .order('nome');
    return (data ?? []) as T[];
  }

  // ── nova verificação: última equipe_id do FVS ──
  if (s.includes('select equipe_id from verificacoes where fvs_planejada_id = ?') && params[0]) {
    const { data } = await supabase
      .from('verificacoes')
      .select('equipe_id')
      .eq('fvs_planejada_id', params[0] as string)
      .order('created_at', { ascending: false })
      .limit(1);
    return (data ?? []) as T[];
  }

  // ── nova verificação: status do FVS ──────────────────
  if (s.includes('select id, subservico, revisao_associada, status from fvs_planejadas where id = ?') && params[0]) {
    const { data } = await supabase.from('fvs_planejadas').select('id, subservico, revisao_associada, status').eq('id', params[0] as string);
    return (data ?? []) as T[];
  }

  // ── nova verificação: count verificacoes fvs ─────────
  if (s.includes('count(*)') && s.includes('from verificacoes') && s.includes('where fvs_planejada_id = ?') && params[0]) {
    const { count } = await supabase.from('verificacoes').select('*', { count: 'exact', head: true }).eq('fvs_planejada_id', params[0] as string);
    return [{ count: count ?? 0 }] as T[];
  }

  if (s.includes('count(*)') && s.includes('from fvs_conclusoes') && s.includes('where fvs_planejada_id = ?') && params[0]) {
    const { count } = await supabase
      .from('fvs_conclusoes')
      .select('*', { count: 'exact', head: true })
      .eq('fvs_planejada_id', params[0] as string);
    return [{ count: count ?? 0 }] as T[];
  }

  // ── re-inspeção: itens da última verificação do FVS (pré-preenchimento) ──
  if (s.includes('from verificacao_itens vi') && s.includes('join verificacoes v') && s.includes('numero_verif desc') && s.includes('limit 1') && params[0]) {
    const fvsId = params[0] as string;
    const { data: verifs } = await supabase
      .from('verificacoes')
      .select('id')
      .eq('fvs_planejada_id', fvsId)
      .order('numero_verif', { ascending: false })
      .limit(1);
    const latestId = (verifs ?? [])[0]?.id;
    if (!latestId) return [];
    const { data: items } = await supabase
      .from('verificacao_itens')
      .select('fvs_padrao_item_id, resultado')
      .eq('verificacao_id', latestId);
    return (items ?? []) as T[];
  }

  // ── nova verificação: NCs abertas do FVS (NCReinspectionBanner + re-inspeção) ──
  if (s.includes('from nao_conformidades nc') && s.includes('join verificacao_itens vi') && (s.includes("nc.status = 'aberta'") || s.includes("nc.status in ('aberta','em_correcao')")) && s.includes('fvs_planejada_id = ?') && params[0]) {
    const fvsId = params[0] as string;
    const { data: verifs } = await supabase.from('verificacoes').select('id, numero_verif, data_verif').eq('fvs_planejada_id', fvsId);
    const verifIds = (verifs ?? []).map((v: any) => v.id as string);
    if (!verifIds.length) return [];
    const verifMap = Object.fromEntries((verifs ?? []).map((v: any) => [v.id, v]));
    const { data: vitens } = await supabase.from('verificacao_itens').select('id, fvs_padrao_item_id, titulo, verificacao_id').in('verificacao_id', verifIds);
    const itemMap = Object.fromEntries((vitens ?? []).map((i: any) => [i.id, i]));
    const itemIds = Object.keys(itemMap);
    if (!itemIds.length) return [];
    const { data: ncs } = await supabase
      .from('nao_conformidades')
      .select('id, verificacao_item_id, descricao, numero_ocorrencia, data_nova_verif, responsavel_id, financeiro_requerido, situacao_financeira')
      .in('verificacao_item_id', itemIds)
      .in('status', ['aberta', 'em_correcao']);
    return ((ncs ?? []).map((nc: any) => {
      const vi = itemMap[nc.verificacao_item_id];
      const v = verifMap[vi?.verificacao_id];
      return {
        nc_id: nc.id,
        fvs_padrao_item_id: vi?.fvs_padrao_item_id ?? null,
        titulo: vi?.titulo ?? '',
        descricao: nc.descricao ?? '',
        numero_ocorrencia: nc.numero_ocorrencia ?? 1,
        data_nova_verif: nc.data_nova_verif ?? null,
        responsavel_id: nc.responsavel_id ?? null,
        numero_verif: v?.numero_verif ?? 1,
        nc_data_criacao: v?.data_verif ?? null,
        financeiro_requerido: nc.financeiro_requerido ? 1 : 0,
        situacao_financeira: nc.situacao_financeira ?? null,
      };
    }) as unknown) as T[];
  }

  // Avaliações de empreiteiros: histórico no app/PWA.
  if (s.includes('e.cnpj_terceiro') && s.includes('u.nome avaliador_nome') && s.includes('from avaliacoes_empreiteiro a')) {
    const { data: evaluation, error } = await supabase.from('avaliacoes_empreiteiro').select('id,status,obra_id,equipe_id,medicao_id,modelo_revisao_id,avaliador_id,data_avaliacao,assinada_em,assinatura_url,pontos_obtidos,pontos_possiveis,percentual,notificacoes_ocorridas,providencias_tomadas,motivo_invalidacao').eq('id', params[0] as string).maybeSingle();
    if (error) throw new Error(`Erro ao carregar documento da avaliação: ${error.message}`);
    if (!evaluation) return [];
    const [workRes, teamRes, measurementRes, revisionRes, userRes] = await Promise.all([
      supabase.from('obras').select('nome').eq('id', evaluation.obra_id).maybeSingle(),
      supabase.from('equipes').select('nome,cnpj_terceiro').eq('id', evaluation.equipe_id).maybeSingle(),
      evaluation.medicao_id ? supabase.from('medicoes_servico').select('referencia').eq('id', evaluation.medicao_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase.from('modelo_avaliacao_empreiteiro_revisoes').select('modelo_id,numero_revisao').eq('id', evaluation.modelo_revisao_id).maybeSingle(),
      supabase.from('usuarios').select('nome').eq('id', evaluation.avaliador_id).maybeSingle(),
    ]);
    if (workRes.error || teamRes.error || measurementRes.error || revisionRes.error || userRes.error) throw new Error('Erro ao montar o documento da avaliação.');
    const { data: model, error: modelError } = revisionRes.data ? await supabase.from('modelos_avaliacao_empreiteiro').select('nome').eq('id', revisionRes.data.modelo_id).maybeSingle() : { data: null, error: null };
    if (modelError) throw new Error(`Erro ao carregar modelo da avaliação: ${modelError.message}`);
    return ([{ ...evaluation, obra_nome: workRes.data?.nome ?? '', equipe_nome: teamRes.data?.nome ?? '', cnpj_terceiro: teamRes.data?.cnpj_terceiro ?? null, referencia: measurementRes.data?.referencia ?? null, modelo_nome: model?.nome ?? 'Modelo de avaliação', numero_revisao: revisionRes.data?.numero_revisao ?? 0, avaliador_nome: userRes.data?.nome ?? null }] as unknown) as T[];
  }

  if (s.includes('from avaliacoes_empreiteiro a') && s.includes('join obras o') && s.includes('join equipes e')) {
    const { data, error } = await supabase
      .from('avaliacoes_empreiteiro')
      .select('id, obra_id, equipe_id, medicao_id, data_avaliacao, status, percentual, obras!avaliacoes_empreiteiro_obra_id_fkey(nome), equipes!avaliacoes_empreiteiro_equipe_id_fkey(nome), medicoes_servico!avaliacoes_empreiteiro_medicao_id_fkey(referencia)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao carregar avaliações: ${error.message}`);
    return ((data ?? []).map((row: any) => ({ ...row, obra_nome: row.obras?.nome ?? '', equipe_nome: row.equipes?.nome ?? '', referencia: row.medicoes_servico?.referencia ?? null })) as unknown) as T[];
  }

  // Avaliação de empreiteiro existente, para retomar/editar: traz a revisão exata
  // gravada na avaliação (não a revisão atual do modelo, que pode já ter mudado).
  if (s.includes('from avaliacoes_empreiteiro a join modelo_avaliacao_empreiteiro_revisoes r')) {
    const { data, error } = await supabase
      .from('avaliacoes_empreiteiro')
      .select('obra_id, equipe_id, medicao_id, modelo_revisao_id, data_avaliacao, status, avaliador_id, notificacoes_ocorridas, providencias_tomadas, modelo_avaliacao_empreiteiro_revisoes!avaliacoes_empreiteiro_modelo_revisao_id_fkey(numero_revisao, modelo_id, modelos_avaliacao_empreiteiro!modelo_avaliacao_empreiteiro_revisoes_modelo_id_fkey(nome, empresa_id))')
      .eq('id', params[0] as string)
      .maybeSingle();
    if (error) throw new Error(`Erro ao carregar avaliação: ${error.message}`);
    if (!data) return [];
    const revision = (data as any).modelo_avaliacao_empreiteiro_revisoes;
    const model = revision?.modelos_avaliacao_empreiteiro;
    return ([{
      obra_id: data.obra_id, equipe_id: data.equipe_id, medicao_id: data.medicao_id,
      modelo_revisao_id: data.modelo_revisao_id, data_avaliacao: data.data_avaliacao, status: data.status, avaliador_id: data.avaliador_id,
      notificacoes_ocorridas: data.notificacoes_ocorridas, providencias_tomadas: data.providencias_tomadas,
      numero_revisao: revision?.numero_revisao ?? 0, modelo_id: revision?.modelo_id ?? '',
      modelo_nome: model?.nome ?? '', modelo_empresa_id: model?.empresa_id ?? null,
    }] as unknown) as T[];
  }

  // Itens já respondidos de uma avaliação existente, para pré-popular a edição.
  if (s.includes('from avaliacao_empreiteiro_itens where avaliacao_id=?') && params[0]) {
    const { data, error } = await supabase
      .from('avaliacao_empreiteiro_itens')
      .select('id, criterio_origem_id, ordem, titulo, peso, resultado, comentario_nao_atende')
      .eq('avaliacao_id', params[0] as string)
      .order('ordem');
    if (error) throw new Error(`Erro ao carregar itens da avaliação: ${error.message}`);
    return (data ?? []) as T[];
  }

  // Medições de terceiros aguardando a avaliação obrigatória.
  if (s.includes('from medicoes_servico m') && s.includes('left join avaliacoes_empreiteiro a') && s.includes("e.tipo='terceirizado'")) {
    const { data: measurements, error } = await supabase
      .from('medicoes_servico')
      .select('id, referencia, obra_id, equipe_id, data_medicao, obras!medicoes_servico_obra_id_fkey(nome), equipes!medicoes_servico_equipe_id_fkey(nome, tipo)')
      .eq('status', 'rascunho')
      .order('data_medicao', { ascending: false });
    if (error) throw new Error(`Erro ao carregar medições: ${error.message}`);
    const thirdParty = (measurements ?? []).filter((row: any) => row.equipes?.tipo === 'terceirizado');
    const ids = thirdParty.map((row: any) => row.id);
    if (!ids.length) return [];
    const { data: finished } = await supabase.from('avaliacoes_empreiteiro').select('medicao_id').in('medicao_id', ids).in('status', ['rascunho', 'concluida', 'aprovada']);
    const evaluated = new Set((finished ?? []).map(row => row.medicao_id));
    return (thirdParty.filter((row: any) => !evaluated.has(row.id)).map((row: any) => ({ id: row.id, referencia: row.referencia, obra_nome: row.obras?.nome ?? '', equipe_nome: row.equipes?.nome ?? '' })) as unknown) as T[];
  }

  // Contexto de uma medição selecionada para iniciar a avaliação.
  if (s.includes('from medicoes_servico m') && s.includes('where m.id=?') && params[0]) {
    const { data, error } = await supabase.from('medicoes_servico').select('id, obra_id, equipe_id, referencia, obras!medicoes_servico_obra_id_fkey(nome), equipes!medicoes_servico_equipe_id_fkey(nome)').eq('id', params[0] as string);
    if (error) throw new Error(`Erro ao carregar medição: ${error.message}`);
    return ((data ?? []).map((row: any) => ({ medicao_id: row.id, obra_id: row.obra_id, equipe_id: row.equipe_id, referencia: row.referencia, obra_nome: row.obras?.nome ?? '', equipe_nome: row.equipes?.nome ?? '' })) as unknown) as T[];
  }

  if (s.includes('select id,nome,empresa_id from obras')) {
    const { data } = await supabase.from('obras').select('id, nome, empresa_id').in('status', ['em_andamento', 'concluida', 'nao_iniciada', 'paralisada']).order('nome');
    return (data ?? []) as T[];
  }

  if (s.includes('from equipes e join obra_equipes oe') && s.includes("e.tipo='terceirizado'")) {
    const { data } = await supabase.from('obra_equipes').select('obra_id, equipes!obra_equipes_equipe_id_fkey(id, nome, tipo, ativo)').order('created_at');
    return ((data ?? []).filter((row: any) => row.equipes?.tipo === 'terceirizado' && row.equipes?.ativo).map((row: any) => ({ id: row.equipes.id, nome: row.equipes.nome, obra_id: row.obra_id })) as unknown) as T[];
  }

  if (s.includes('from modelos_avaliacao_empreiteiro m') && s.includes('modelo_avaliacao_empreiteiro_revisoes')) {
    const { data, error } = await supabase.from('modelos_avaliacao_empreiteiro').select('id, empresa_id, nome, revisao_atual, modelo_avaliacao_empreiteiro_revisoes!modelo_avaliacao_empreiteiro_revisoes_modelo_id_fkey(id, numero_revisao)').eq('ativo', true).order('nome');
    if (error) throw new Error(`Erro ao carregar modelos: ${error.message}`);
    return ((data ?? []).map((row: any) => { const revision=(row.modelo_avaliacao_empreiteiro_revisoes ?? []).find((r: any)=>r.numero_revisao===row.revisao_atual); return revision?{model_id:row.id,empresa_id:row.empresa_id,nome:row.nome,revisao_id:revision.id,numero_revisao:revision.numero_revisao}:null; }).filter(Boolean) as unknown) as T[];
  }

  if (s.includes('from modelo_avaliacao_empreiteiro_criterios where revisao_id=?') && params[0]) {
    const { data } = await supabase.from('modelo_avaliacao_empreiteiro_criterios').select('id, titulo, peso, ordem').eq('revisao_id', params[0] as string).order('ordem');
    return (data ?? []) as T[];
  }

  console.warn('[powersync-web-shim] unmatched query:', sql.slice(0, 120));
  return [];
}

// ─────────────────────────────────────────────────────────
// INSERT / UPDATE → Supabase
// ─────────────────────────────────────────────────────────
async function resolvePendingWebMedia(value: unknown, filename: string): Promise<unknown> {
  if (typeof value !== 'string' || !value.startsWith('pending:')) return value;
  const localValue = value.slice('pending:'.length);
  if (localValue.startsWith('blob:')) return uploadBlobToR2(localValue, filename);
  if (localValue.startsWith('data:')) return uploadDataUrlToR2(localValue, filename);
  throw new Error('Formato de mídia pendente inválido no PWA.');
}

async function resolvePendingSignatureWebMedia(value: unknown, filename: string): Promise<unknown> {
  if (typeof value !== 'string' || !value.startsWith('pending:')) return value;
  const localValue = value.slice('pending:'.length);
  const blob = await fetch(localValue).then(response => response.blob());
  return uploadToR2(blob, filename, 'image/png');
}

async function executeOnSupabase(sql: string, params: unknown[]): Promise<void> {
  const s = sql.trim().toLowerCase().replace(/\s+/g, ' ');

  // UPDATE verificacoes SET assinatura_url = ?, assinada_em = ? WHERE id = ?
  if (s.startsWith('update verificacoes set assinatura_url')) {
    const assinaturaUrl = params[0] as string;
    const assinadaEm = params[1] as string;
    const id = params[2] as string;

    // On web, signature arrives as "pending:data:image/png;base64,..." — strip the pending: prefix
    // then upload the data URL to R2.
    let finalUrl = assinaturaUrl;
    const rawSig = assinaturaUrl.startsWith('pending:') ? assinaturaUrl.slice('pending:'.length) : assinaturaUrl;
    if (rawSig.startsWith('data:') || rawSig.startsWith('blob:')) {
      try {
        finalUrl = await resolvePendingSignatureWebMedia(assinaturaUrl, `sig_${id}.png`) as string;
      } catch (e) {
        console.error('[web shim] signature upload failed:', e);
        throw e;
      }
    }

    const { error } = await supabase.from('verificacoes').update({ assinatura_url: finalUrl, assinada_em: assinadaEm }).eq('id', id);
    if (error) throw new Error(`Erro ao salvar assinatura: ${error.message}`);
    return;
  }

  // Generic UPDATE <table> SET col = ?, ... WHERE id = ?
  if (s.startsWith('update ') && s.includes(' set ') && s.includes('where id = ?')) {
    const tableMatch = s.match(/update (\w+) set/);
    const setMatch = s.match(/set (.+) where id = \?/);
    if (!tableMatch || !setMatch) {
      console.warn('[web shim] could not parse UPDATE:', sql.slice(0, 80));
      return;
    }
    const table = tableMatch[1];
    const setFields = setMatch[1]
      .split(',')
      .map(p => p.trim().match(/^(\w+)\s*=\s*\?/)?.[1])
      .filter((f): f is string => !!f);

    const idParam = params[params.length - 1] as string;
    const updateData: Record<string, unknown> = {};
    for (let i = 0; i < setFields.length; i++) {
      const field = setFields[i];
      updateData[field] = field.includes('assinatura')
        ? await resolvePendingSignatureWebMedia(params[i], `${table}_${field}_${Date.now()}.png`)
        : await resolvePendingWebMedia(params[i], `${table}_${field}_${Date.now()}.jpg`);
    }

    const { error } = await dynamicTable(table).update(updateData).eq('id', idParam);
    if (error) {
      console.error(`[web shim] UPDATE ${table} error:`, error.message, updateData);
      throw new Error(`Erro ao atualizar ${table}: ${error.message}`);
    }
    return;
  }

  // Generic INSERT INTO <table> (<cols>) VALUES (...)
  if (s.startsWith('insert into')) {
    const tableMatch = s.match(/insert into (\w+)/);
    const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (!tableMatch || !colsMatch) {
      console.warn('[web shim] could not parse INSERT:', sql.slice(0, 80));
      return;
    }

    const table = tableMatch[1];
    const cols = colsMatch[1].split(',').map(c => c.trim().replace(/[`'"]/g, ''));
    const row: Record<string, unknown> = {};

    // Generate and upload the small preview beside the original evidence.
    // Signatures and other media remain on their own PNG path.
    if ((table === 'verificacao_fotos' || table === 'nc_fotos') && !cols.includes('r2_thumb_key')) {
      const source = params[cols.indexOf('r2_key')];
      if (typeof source === 'string' && source.startsWith('pending:')) {
        const localPath = source.slice('pending:'.length);
        if (localPath.startsWith('blob:') || localPath.startsWith('data:')) {
          const thumb = await createEvidenceThumbnail(localPath);
          row.r2_thumb_key = await uploadToR2(thumb, `thumb_${Date.now()}.jpg`, 'image/jpeg');
        }
      }
    }

    for (let i = 0; i < cols.length && i < params.length; i++) {
      let val = params[i];
      // Resolve pending: photo paths on web
      if (typeof val === 'string' && val.startsWith('pending:')) {
        const localPath = val.slice('pending:'.length);
        if (cols[i].includes('assinatura')) {
          val = await resolvePendingSignatureWebMedia(val, `${table}_${cols[i]}_${Date.now()}.png`);
        } else if (localPath.startsWith('blob:')) {
          try {
            val = await uploadBlobToR2(localPath, `photo_${Date.now()}.jpg`);
          } catch (e) {
            console.error('[web shim] photo upload failed:', e);
            throw e;
          }
        } else if (localPath.startsWith('data:')) {
          val = await uploadDataUrlToR2(localPath, `photo_${Date.now()}.jpg`);
        }
      }
      row[cols[i]] = val;
    }

    // Remove created_offline on web — we're always online
    delete row['created_offline'];

    const { error } = await dynamicTable(table).insert(row);
    if (error) {
      console.error(`[web shim] INSERT ${table} error:`, error.message, row);
      throw new Error(`Erro ao salvar ${table}: ${error.message}`);
    }
    return;
  }

  // Nothing above matched — this write silently did nothing on web. A previous
  // instance of this (an UPDATE whose WHERE clause didn't spell 'where id = ?'
  // exactly) left signed avaliações stuck in rascunho with no error anywhere.
  // Surface it loudly instead of returning quietly.
  console.error('[web shim] unmatched write, nothing was saved:', sql.slice(0, 160));
  throw new Error('Esta operação não é suportada na versão web (grave localmente e reporte).');
}

// ─────────────────────────────────────────────────────────
// R2 upload helpers
// ─────────────────────────────────────────────────────────
async function uploadBlobToR2(blobUrl: string, filename: string): Promise<string> {
  const blob = await fetch(blobUrl).then(r => r.blob());
  return uploadToR2(blob, filename, 'image/jpeg');
}

async function uploadDataUrlToR2(dataUrl: string, filename: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return uploadToR2(blob, filename, 'image/png');
}

async function uploadToR2(blob: Blob, filename: string, mimeType: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const presignRes = await fetch(`${supabaseUrl}/functions/v1/r2-presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename, mimeType, contentLength: blob.size }),
  });

  if (!presignRes.ok) throw new Error(`presign failed: ${presignRes.status}`);
  const { uploadUrl, key } = await presignRes.json() as { uploadUrl: string; key: string };

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });

  if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.status}`);

  return key;
}
