/**
 * PowerSync web shim
 * Replaces @powersync/react-native on the web platform.
 * Exports the same interface used by all screens, backed by Supabase REST.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────
// PowerSyncContext (no-op on web — screens don't read it)
// ─────────────────────────────────────────────────────────
export const PowerSyncContext = createContext<null>(null);

// ─────────────────────────────────────────────────────────
// useQuery — maps SQL patterns to Supabase queries
// ─────────────────────────────────────────────────────────
export function useQuery<T>(sql: string, params?: unknown[]): { data: T[] } {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchFromSupabase<T>(sql, params ?? []).then(rows => {
      if (!cancelled) setData(rows);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, JSON.stringify(params ?? [])]);

  return { data };
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
  },
};

// ─────────────────────────────────────────────────────────
// User access cache — which obras the current user can see
// null = admin (all obras); string[] = allowed IDs
// ─────────────────────────────────────────────────────────
let _obraIdsCache: { ids: string[] | null; ts: number } | null = null;

async function getAllowedObraIds(): Promise<string[] | null> {
  if (_obraIdsCache && Date.now() - _obraIdsCache.ts < 30_000) return _obraIdsCache.ids;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { _obraIdsCache = { ids: [], ts: Date.now() }; return []; }
  const { data: u } = await supabase.from('usuarios').select('perfil').eq('id', user.id).single();
  if ((u as any)?.perfil === 'admin') {
    _obraIdsCache = { ids: null, ts: Date.now() };
    return null;
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

// ─────────────────────────────────────────────────────────
// SQL → Supabase dispatch
// ─────────────────────────────────────────────────────────
async function fetchFromSupabase<T>(sql: string, params: unknown[]): Promise<T[]> {
  const s = sql.trim().toLowerCase().replace(/\s+/g, ' ');

  // ── usuarios ──────────────────────────────────────────
  if (s.includes('from usuarios') && !s.includes('join')) {
    const { data } = await supabase.from('usuarios').select('id, nome, cargo, perfil').limit(1);
    return (data ?? []) as T[];
  }

  // ── obras ativas (obras list screen) ──────────────────
  if (s.includes('progresso_percentual') && s.includes('o.municipio') && s.includes('from obras o') && s.includes('where o.ativo = 1')) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_obras_com_fvs'), getAllowedObraIds()]);
    return filterByObraId((data ?? []) as T[], 'id' as keyof T, ids);
  }

  // ── obras ativas count ─────────────────────────────────
  if (s.includes('count(*)') && s.includes('from obras') && s.includes('ativo = 1') && !s.includes('join')) {
    const ids = await getAllowedObraIds();
    let q = supabase.from('obras').select('*', { count: 'exact', head: true }).eq('ativo', 1);
    if (ids !== null && ids.length > 0) q = q.in('id', ids);
    else if (ids !== null && ids.length === 0) return [{ count: 0 }] as T[];
    const { count } = await q;
    return [{ count: count ?? 0 }] as T[];
  }

  // ── obras ativas lista simples (perfil) ───────────────
  if (s.includes('from obras o where o.ativo = 1') && s.includes('select o.id, o.nome')) {
    const [{ data }, ids] = await Promise.all([
      supabase.from('obras').select('id, nome, municipio, uf').eq('ativo', 1).order('nome'),
      getAllowedObraIds()
    ]);
    return filterByObraId((data ?? []) as T[], 'id' as keyof T, ids);
  }

  // ── ncs abertas count (com ou sem joins de obra) ──────
  if (s.includes("status = 'aberta'") && s.includes('count(*)') && s.includes('from nao_conformidades') && !s.includes('date(n.data_nova_verif)') && !s.includes('from ambientes') && !s.includes('from obras o')) {
    const [{ data: ncs }, ids] = await Promise.all([supabase.rpc('get_ncs_full'), getAllowedObraIds()]);
    const filtered = filterByObraId((ncs ?? []) as any[], 'obra_id', ids).filter((n: any) => n.status === 'aberta');
    return [{ count: filtered.length }] as T[];
  }

  // ── ncs vencendo hoje count ────────────────────────────
  if (s.includes("status = 'aberta'") && s.includes('count(*)') && s.includes('date(') && s.includes('data_nova_verif')) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: ncs }, ids] = await Promise.all([supabase.rpc('get_ncs_full'), getAllowedObraIds()]);
    const filtered = filterByObraId((ncs ?? []) as any[], 'obra_id', ids)
      .filter((n: any) => n.status === 'aberta' && n.data_nova_verif?.slice(0, 10) === today);
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
      .filter((n: any) => n.status === 'aberta')
      .sort((a: any, b: any) => (a.data_nova_verif ?? '').localeCompare(b.data_nova_verif ?? ''))
      .slice(0, 3);
    return filtered as T[];
  }

  // ── obras com progresso (dashboard) ───────────────────
  if (s.includes('progresso_percentual') && s.includes('empresa_nome') && s.includes('from obras o') && s.includes('where o.ativo = 1') && s.includes('limit 5')) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_obras_com_fvs'), getAllowedObraIds()]);
    return filterByObraId((data ?? []) as T[], 'id' as keyof T, ids).slice(0, 5);
  }

  // ── verificações recentes (dashboard) ─────────────────
  if (s.includes('from verificacoes v') && s.includes('join fvs_planejadas fp') && s.includes('order by v.data_verif desc') && s.includes('limit 3')) {
    const [{ data }, ids] = await Promise.all([supabase.rpc('get_verificacoes_recentes'), getAllowedObraIds()]);
    return filterByObraId((data ?? []) as T[], 'obra_id' as keyof T, ids).slice(0, 3);
  }

  // ── lista NCs com joins (tela NC) ─────────────────────
  if (s.includes('from nao_conformidades n') && s.includes('join verificacao_itens vi') && s.includes('join obras o') && s.includes("n.status in ('aberta', 'resolvida')")) {
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
    const { data } = await supabase.from('ambientes').select('id, nome, tipo, localizacao, obras(nome)').eq('id', params[0] as string);
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

  // ── nova verificação: usuario ──────────────────────────
  if (s.includes('select id, nome, cargo from usuarios limit 1')) {
    const { data } = await supabase.from('usuarios').select('id, nome, cargo').limit(1);
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

  // ── nova verificação: último percentual_exec do FVS ──
  if (s.includes('select percentual_exec from verificacoes where fvs_planejada_id = ?') && params[0]) {
    const { data } = await supabase
      .from('verificacoes')
      .select('percentual_exec')
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

  console.warn('[powersync-web-shim] unmatched query:', sql.slice(0, 120));
  return [];
}

// ─────────────────────────────────────────────────────────
// INSERT / UPDATE → Supabase
// ─────────────────────────────────────────────────────────
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
    if (rawSig.startsWith('data:')) {
      try {
        finalUrl = await uploadDataUrlToR2(rawSig, `sig_${id}.png`);
      } catch (e) {
        console.warn('[web shim] signature upload failed, storing data URL directly:', e);
        finalUrl = rawSig; // fallback: store data URL (works for display but not ideal)
      }
    }

    const { error } = await supabase.from('verificacoes').update({ assinatura_url: finalUrl, assinada_em: assinadaEm }).eq('id', id);
    if (error) throw new Error(`Erro ao salvar assinatura: ${error.message}`);
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

    for (let i = 0; i < cols.length && i < params.length; i++) {
      let val = params[i];
      // Resolve pending: photo paths on web
      if (typeof val === 'string' && val.startsWith('pending:')) {
        const localPath = val.slice('pending:'.length);
        if (localPath.startsWith('blob:')) {
          try {
            val = await uploadBlobToR2(localPath, `photo_${Date.now()}.jpg`);
          } catch (e) {
            console.error('[web shim] photo upload failed:', e);
            val = localPath;
          }
        }
      }
      row[cols[i]] = val;
    }

    // Remove created_offline on web — we're always online
    delete row['created_offline'];

    const { error } = await supabase.from(table).insert(row);
    if (error) {
      console.error(`[web shim] INSERT ${table} error:`, error.message, row);
      throw new Error(`Erro ao salvar ${table}: ${error.message}`);
    }
  }
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
    body: JSON.stringify({ filename, mimeType }),
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
