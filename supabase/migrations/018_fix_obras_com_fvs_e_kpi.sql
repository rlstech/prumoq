-- Corrige v_obras_com_fvs e get_obra_kpi para incluir os status 'concluida' e
-- 'concluida_ressalva' (adicionados na migration 011) que eram ignorados
-- na contagem de fvs_concluidas e no cálculo de progresso_percentual.
-- A migration 017 havia corrigido get_ambientes_obra e get_obras_progresso_dashboard
-- mas esqueceu v_obras_com_fvs (usada por get_obras_com_fvs) e get_obra_kpi.

CREATE OR REPLACE VIEW public.v_obras_com_fvs AS
SELECT
  o.id, o.nome, o.status, o.endereco, o.municipio, o.uf,
  o.eng_responsavel AS engenheiro_nome,
  o.crea_cau        AS engenheiro_crea,
  e.nome            AS empresa_nome,
  COUNT(DISTINCT a.id) AS total_ambientes,
  COUNT(DISTINCT f.id) AS total_fvs,
  COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS fvs_concluidas,
  SUM(CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN 100
           WHEN f.status = 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
           ELSE 0
      END)::double precision / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual,
  (
    SELECT COUNT(*)
    FROM nao_conformidades n
    WHERE n.status = 'aberta'
      AND n.verificacao_id IN (
        SELECT v.id FROM verificacoes v
        JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
        JOIN ambientes a2       ON a2.id  = fp2.ambiente_id
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
    COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS fvs_concluidas,
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      WHERE n.status = 'aberta'
        AND n.verificacao_id IN (
          SELECT v.id FROM verificacoes v
          JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
          JOIN ambientes a2       ON a2.id  = fp2.ambiente_id
          WHERE a2.obra_id = p_obra_id
        )
    ) AS ncs_abertas,
    SUM(CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN 100
             WHEN f.status = 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
             ELSE 0
        END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
  FROM obras o
  LEFT JOIN ambientes      a ON a.obra_id = o.id
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE o.id = p_obra_id;
$$;
