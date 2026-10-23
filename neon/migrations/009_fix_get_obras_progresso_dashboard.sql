CREATE OR REPLACE FUNCTION get_obras_progresso_dashboard()
RETURNS TABLE (
  id uuid,
  nome text,
  status text,
  municipio text,
  uf text,
  empresa_nome text,
  total_ambientes bigint,
  total_fvs bigint,
  fvs_concluidas bigint,
  progresso_percentual float,
  ncs_abertas bigint
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT o.id, o.nome, o.status::text, o.municipio, o.uf,
         e.nome AS empresa_nome,
         COUNT(DISTINCT a.id) AS total_ambientes,
         COUNT(DISTINCT f.id) AS total_fvs,
         COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
         SUM(CASE f.status
           WHEN 'conforme'     THEN 100
           WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
           ELSE 0
         END)::float / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual,
         COUNT(DISTINCT n.id) AS ncs_abertas
  FROM obras o
  LEFT JOIN empresas e         ON e.id = o.empresa_id
  LEFT JOIN ambientes a       ON a.obra_id = o.id AND a.ativo = true
  LEFT JOIN fvs_planejadas f  ON f.ambiente_id = a.id
  LEFT JOIN nao_conformidades n ON n.status IN ('aberta', 'em_correcao')
    AND n.verificacao_id IN (
      SELECT v.id FROM verificacoes v
      JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
      WHERE fp.ambiente_id = a.id
    )
  WHERE o.ativo = true
  GROUP BY o.id, e.nome
  ORDER BY o.nome
  LIMIT 5;
$$;