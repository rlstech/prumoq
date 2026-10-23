-- ============================================================
-- Migration 007: corrige progresso inflado pelo JOIN de NCs
-- ============================================================
-- Bug: LEFT JOIN nao_conformidades multiplicava linhas quando um
-- FVS tinha múltiplas NCs abertas, inflando o SUM de percentual.
-- Exemplo: 1 FVS conforme (100%) + 2 NCs → SUM=200, COUNT(DISTINCT)=1
-- → ambiente mostrava 200% e obra 100% (deveria ser 100% e 50%).
--
-- Correção: subquery correlacionada para ncs_abertas, sem JOIN lateral.
-- ============================================================

-- 1. Recriar view v_obras_com_fvs sem LEFT JOIN de nao_conformidades
CREATE OR REPLACE VIEW public.v_obras_com_fvs AS
SELECT
  o.id,
  o.nome,
  o.status,
  o.endereco,
  o.municipio,
  o.uf,
  o.eng_responsavel  AS engenheiro_nome,
  o.crea_cau         AS engenheiro_crea,
  e.nome             AS empresa_nome,
  COUNT(DISTINCT a.id) AS total_ambientes,
  COUNT(DISTINCT f.id) AS total_fvs,
  COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
  SUM(CASE f.status
    WHEN 'conforme'     THEN 100
    WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
    ELSE 0
  END)::double precision / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual,
  (
    SELECT COUNT(*)
    FROM nao_conformidades n
    WHERE n.status = 'aberta'
      AND n.verificacao_id IN (
        SELECT v.id FROM verificacoes v
        JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
        JOIN ambientes a2      ON a2.id   = fp2.ambiente_id
        WHERE a2.obra_id = o.id
      )
  ) AS ncs_abertas
FROM obras o
LEFT JOIN empresas       e ON e.id = o.empresa_id
LEFT JOIN ambientes      a ON a.obra_id = o.id
LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
WHERE o.ativo = true
GROUP BY o.id, e.nome
ORDER BY o.nome;

-- 2. Recriar get_obra_kpi sem LEFT JOIN de nao_conformidades
CREATE OR REPLACE FUNCTION public.get_obra_kpi(p_obra_id uuid)
RETURNS TABLE(
  total_ambientes      bigint,
  total_fvs            bigint,
  fvs_concluidas       bigint,
  ncs_abertas          bigint,
  progresso_percentual double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(DISTINCT a.id) AS total_ambientes,
    COUNT(DISTINCT f.id) AS total_fvs,
    COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      WHERE n.status = 'aberta'
        AND n.verificacao_id IN (
          SELECT v.id FROM verificacoes v
          JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
          JOIN ambientes a2      ON a2.id   = fp2.ambiente_id
          WHERE a2.obra_id = p_obra_id
        )
    ) AS ncs_abertas,
    SUM(CASE f.status
      WHEN 'conforme'     THEN 100
      WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
      ELSE 0
    END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
  FROM obras o
  LEFT JOIN ambientes      a ON a.obra_id = o.id
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE o.id = p_obra_id;
$$;

-- 3. Recriar get_ambientes_obra sem LEFT JOIN de nao_conformidades
CREATE OR REPLACE FUNCTION public.get_ambientes_obra(p_obra_id uuid)
RETURNS TABLE(
  id                   uuid,
  nome                 text,
  tipo                 text,
  localizacao          text,
  total_fvs            bigint,
  fvs_concluidas       bigint,
  ncs_abertas          bigint,
  progresso_percentual double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    a.id, a.nome, a.tipo::text, a.localizacao,
    COUNT(DISTINCT f.id) AS total_fvs,
    COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      WHERE n.status = 'aberta'
        AND n.verificacao_id IN (
          SELECT v.id FROM verificacoes v
          WHERE v.fvs_planejada_id IN (
            SELECT fp2.id FROM fvs_planejadas fp2 WHERE fp2.ambiente_id = a.id
          )
        )
    ) AS ncs_abertas,
    SUM(CASE f.status
      WHEN 'conforme'     THEN 100
      WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
      ELSE 0
    END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
  FROM ambientes      a
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE a.obra_id = p_obra_id AND a.ativo = true
  GROUP BY a.id
  ORDER BY a.nome;
$$;
