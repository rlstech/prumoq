-- ============================================================
-- PrumoQ — Views e RPCs para suporte web (PWA)
-- Criar no SQL Editor do Supabase Dashboard
-- Todas as views usam SECURITY INVOKER (respeita RLS)
-- ============================================================

-- ── v_obras_com_fvs ──────────────────────────────────────────
-- Usada pela tela de lista de obras (obras/index.tsx)
CREATE OR REPLACE VIEW v_obras_com_fvs AS
SELECT
  o.id,
  o.nome,
  o.status,
  o.endereco,
  o.municipio,
  o.uf,
  o.eng_responsavel                          AS engenheiro_nome,
  o.crea_cau                                 AS engenheiro_crea,
  e.nome                                     AS empresa_nome,
  COUNT(DISTINCT a.id)                       AS total_ambientes,
  COUNT(DISTINCT f.id)                       AS total_fvs,
  COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
  SUM(CASE f.status
    WHEN 'conforme'     THEN 100
    WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
    ELSE 0
  END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual,
  COUNT(DISTINCT n.id)                       AS ncs_abertas
FROM obras o
LEFT JOIN empresas e         ON e.id = o.empresa_id
LEFT JOIN ambientes a        ON a.obra_id = o.id
LEFT JOIN fvs_planejadas f   ON f.ambiente_id = a.id
LEFT JOIN nao_conformidades n ON n.status = 'aberta'
  AND n.verificacao_id IN (
    SELECT v.id FROM verificacoes v
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    WHERE fp.ambiente_id = a.id
  )
WHERE o.ativo = true
GROUP BY o.id, e.nome
ORDER BY o.nome;

-- RPC wrapper
CREATE OR REPLACE FUNCTION get_obras_com_fvs()
RETURNS TABLE (
  id uuid, nome text, status text, endereco text, municipio text, uf text,
  engenheiro_nome text, engenheiro_crea text, empresa_nome text,
  total_ambientes bigint, total_fvs bigint, fvs_concluidas bigint,
  progresso_percentual float, ncs_abertas bigint
)
LANGUAGE sql STABLE AS $$
  SELECT id, nome, status, endereco, municipio, uf,
         engenheiro_nome, engenheiro_crea, empresa_nome,
         total_ambientes, total_fvs, fvs_concluidas,
         progresso_percentual, ncs_abertas
  FROM v_obras_com_fvs;
$$;

-- ── get_ncs_urgentes ─────────────────────────────────────────
-- Dashboard: 3 NCs abertas com prazo mais próximo
CREATE OR REPLACE FUNCTION get_ncs_urgentes()
RETURNS TABLE (
  id uuid, item_titulo text, ambiente_nome text,
  obra_nome text, data_nova_verif date
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT n.id, vi.titulo AS item_titulo, a.nome AS ambiente_nome,
         o.nome AS obra_nome, n.data_nova_verif
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v        ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp     ON fp.id = v.fvs_planejada_id
  JOIN ambientes a           ON a.id = fp.ambiente_id
  JOIN obras o               ON o.id = a.obra_id
  WHERE n.status = 'aberta'
  ORDER BY n.data_nova_verif ASC NULLS LAST
  LIMIT 3;
$$;

-- ── get_obras_progresso_dashboard ────────────────────────────
-- Dashboard: até 5 obras ativas com progresso (sem ncs_abertas)
CREATE OR REPLACE FUNCTION get_obras_progresso_dashboard()
RETURNS TABLE (
  id uuid, nome text, total_fvs bigint, fvs_concluidas bigint,
  progresso_percentual float
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT o.id, o.nome,
         COUNT(DISTINCT f.id) AS total_fvs,
         COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
         SUM(CASE f.status
           WHEN 'conforme'     THEN 100
           WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
           ELSE 0
         END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
  FROM obras o
  LEFT JOIN ambientes a  ON a.obra_id = o.id
  LEFT JOIN fvs_planejadas f  ON f.ambiente_id = a.id
  WHERE o.ativo = true
  GROUP BY o.id
  LIMIT 5;
$$;

-- ── get_verificacoes_recentes ─────────────────────────────────
-- Dashboard: 3 verificações mais recentes (com IDs para navegação)
CREATE OR REPLACE FUNCTION get_verificacoes_recentes()
RETURNS TABLE (
  id uuid, status text, data_verif date,
  ambiente_nome text, obra_nome text, fvs_nome text,
  fvs_planejada_id uuid, ambiente_id uuid, obra_id uuid
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT v.id, v.status, v.data_verif,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         fp.subservico AS fvs_nome,
         fp.id AS fvs_planejada_id,
         a.id  AS ambiente_id,
         o.id  AS obra_id
  FROM verificacoes v
  JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
  JOIN ambientes a        ON a.id = fp.ambiente_id
  JOIN obras o            ON o.id = a.obra_id
  ORDER BY v.data_verif DESC
  LIMIT 3;
$$;

-- ── get_ncs_full ──────────────────────────────────────────────
-- Tela de NCs: lista completa com joins
CREATE OR REPLACE FUNCTION get_ncs_full()
RETURNS TABLE (
  id uuid, descricao text, status text, data_nova_verif date,
  prioridade text, item_titulo text, ambiente_nome text,
  obra_nome text, responsavel_nome text,
  fvs_planejada_id uuid, obra_id uuid, ambiente_id uuid
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT n.id, n.descricao, n.status, n.data_nova_verif, n.prioridade,
         vi.titulo AS item_titulo,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         e.nome AS responsavel_nome,
         fp.id AS fvs_planejada_id,
         o.id AS obra_id, a.id AS ambiente_id
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v        ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp     ON fp.id = v.fvs_planejada_id
  JOIN ambientes a           ON a.id = fp.ambiente_id
  JOIN obras o               ON o.id = a.obra_id
  LEFT JOIN equipes e        ON e.id = n.responsavel_id
  WHERE n.status IN ('aberta', 'resolvida')
  ORDER BY n.data_nova_verif ASC NULLS LAST;
$$;

-- ── get_ncs_abertas_inspetor ──────────────────────────────────
-- Perfil: contagem de NCs abertas do inspetor logado
CREATE OR REPLACE FUNCTION get_ncs_abertas_inspetor(p_inspetor_id uuid)
RETURNS TABLE (count bigint)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT COUNT(*) AS count
  FROM nao_conformidades n
  JOIN verificacoes v ON v.id = n.verificacao_id
  WHERE v.inspetor_id = p_inspetor_id AND n.status = 'aberta';
$$;

-- ── get_obra_kpi ──────────────────────────────────────────────
-- Detalhe da obra: KPIs (ambientes, FVS, concluídas, NCs)
CREATE OR REPLACE FUNCTION get_obra_kpi(p_obra_id uuid)
RETURNS TABLE (
  total_ambientes bigint, total_fvs bigint,
  fvs_concluidas bigint, ncs_abertas bigint,
  progresso_percentual float
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT
    COUNT(DISTINCT a.id)  AS total_ambientes,
    COUNT(DISTINCT f.id)  AS total_fvs,
    COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
    COUNT(DISTINCT n.id)  AS ncs_abertas,
    SUM(CASE f.status
      WHEN 'conforme'     THEN 100
      WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
      ELSE 0
    END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
  FROM obras o
  LEFT JOIN ambientes a   ON a.obra_id = o.id
  LEFT JOIN fvs_planejadas f   ON f.ambiente_id = a.id
  LEFT JOIN nao_conformidades n ON n.status = 'aberta'
    AND n.verificacao_id IN (
      SELECT v.id FROM verificacoes v
      JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
      WHERE fp.ambiente_id = a.id
    )
  WHERE o.id = p_obra_id;
$$;

-- ── get_ambientes_obra ────────────────────────────────────────
-- Detalhe da obra: ambientes com progresso e NCs
CREATE OR REPLACE FUNCTION get_ambientes_obra(p_obra_id uuid)
RETURNS TABLE (
  id uuid, nome text, tipo text, localizacao text,
  total_fvs bigint, fvs_concluidas bigint, ncs_abertas bigint,
  progresso_percentual float
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT a.id, a.nome, a.tipo, a.localizacao,
    COUNT(DISTINCT f.id) AS total_fvs,
    COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
    COUNT(DISTINCT n.id) AS ncs_abertas,
    SUM(CASE f.status
      WHEN 'conforme'     THEN 100
      WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
      ELSE 0
    END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
  FROM ambientes a
  LEFT JOIN fvs_planejadas f   ON f.ambiente_id = a.id
  LEFT JOIN nao_conformidades n ON n.status = 'aberta'
    AND n.verificacao_id IN (
      SELECT v.id FROM verificacoes v
      JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
      WHERE fp.ambiente_id = a.id
    )
  WHERE a.obra_id = p_obra_id AND a.ativo = true
  GROUP BY a.id
  ORDER BY a.nome;
$$;

-- ── get_fvs_ambiente ──────────────────────────────────────────
-- Detalhe do ambiente: lista de FVS planejadas
CREATE OR REPLACE FUNCTION get_fvs_ambiente(p_ambiente_id uuid)
RETURNS TABLE (
  id uuid, subservico text, status text,
  total_verificacoes bigint, ultima_verif date
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT fp.id, fp.subservico, fp.status,
    COUNT(v.id)      AS total_verificacoes,
    MAX(v.data_verif) AS ultima_verif
  FROM fvs_planejadas fp
  LEFT JOIN verificacoes v ON v.fvs_planejada_id = fp.id
  WHERE fp.ambiente_id = p_ambiente_id
  GROUP BY fp.id
  ORDER BY fp.subservico;
$$;

-- ── get_fvs_detalhe ───────────────────────────────────────────
-- Cabeçalho do FVS (tela de histórico)
CREATE OR REPLACE FUNCTION get_fvs_detalhe(p_fvs_id uuid)
RETURNS TABLE (
  id uuid, subservico text, status text,
  ambiente_nome text, obra_nome text
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT fp.id, fp.subservico, fp.status,
         a.nome AS ambiente_nome, o.nome AS obra_nome
  FROM fvs_planejadas fp
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o     ON o.id = a.obra_id
  WHERE fp.id = p_fvs_id;
$$;

-- ── get_verificacoes_fvs ──────────────────────────────────────
-- Histórico: verificações de um FVS ordenadas por data
CREATE OR REPLACE FUNCTION get_verificacoes_fvs(p_fvs_id uuid)
RETURNS TABLE (
  id uuid, numero_verif int, data_verif date, status text,
  observacoes text, assinatura_url text, percentual_exec int,
  created_offline boolean, inspetor_nome text, created_at timestamptz
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT v.id, v.numero_verif, v.data_verif, v.status,
         v.observacoes, v.assinatura_url, v.percentual_exec,
         v.created_offline, u.nome AS inspetor_nome,
         v.created_at
  FROM verificacoes v
  LEFT JOIN usuarios u ON u.id = v.inspetor_id
  WHERE v.fvs_planejada_id = p_fvs_id
  ORDER BY v.created_at DESC;
$$;

-- ── get_ncs_fvs ───────────────────────────────────────────────
-- Histórico: NCs de um FVS
CREATE OR REPLACE FUNCTION get_ncs_fvs(p_fvs_id uuid)
RETURNS TABLE (
  id uuid, verificacao_id uuid, descricao text,
  solucao_proposta text, data_nova_verif date,
  status text, item_titulo text, responsavel_nome text
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT n.id, n.verificacao_id, n.descricao, n.solucao_proposta,
         n.data_nova_verif, n.status, vi.titulo AS item_titulo,
         e.nome AS responsavel_nome
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  LEFT JOIN equipes e       ON e.id = n.responsavel_id
  WHERE n.verificacao_id IN (
    SELECT id FROM verificacoes WHERE fvs_planejada_id = p_fvs_id
  );
$$;

-- ── get_fotos_fvs ─────────────────────────────────────────────
-- Histórico: fotos de verificações de um FVS
CREATE OR REPLACE FUNCTION get_fotos_fvs(p_fvs_id uuid)
RETURNS TABLE (
  id uuid, verificacao_id uuid, r2_key text, ordem int
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT id, verificacao_id, r2_key, ordem
  FROM verificacao_fotos
  WHERE verificacao_id IN (
    SELECT id FROM verificacoes WHERE fvs_planejada_id = p_fvs_id
  )
  ORDER BY verificacao_id, ordem;
$$;

-- ── get_itens_checklist ───────────────────────────────────────
-- Nova verificação: itens do checklist para um FVS
CREATE OR REPLACE FUNCTION get_itens_checklist(p_fvs_id uuid)
RETURNS TABLE (
  id uuid, ordem int, titulo text, metodo_verif text, tolerancia text
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT fpi.id, fpi.ordem, fpi.titulo, fpi.metodo_verif, fpi.tolerancia
  FROM fvs_padrao_itens fpi
  JOIN fvs_planejadas fp ON fp.fvs_padrao_id = fpi.fvs_padrao_id
    AND fpi.revisao = fp.revisao_associada
  WHERE fp.id = p_fvs_id
  ORDER BY fpi.ordem;
$$;
