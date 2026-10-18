-- ============================================================
-- Fix get_ncs_full(): incluir todos os status (exceto cancelada)
-- e usar data_nova_verif para ordenação (coluna correta)
-- ============================================================
CREATE OR REPLACE FUNCTION get_ncs_full()
RETURNS TABLE (
  id uuid, descricao text, status text, data_nova_verif date,
  prioridade text, item_titulo text, ambiente_nome text,
  obra_nome text, responsavel_nome text,
  fvs_planejada_id uuid, obra_id uuid, ambiente_id uuid,
  prazo_correcao date
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT n.id, n.descricao, n.status, n.data_nova_verif, n.prioridade,
         vi.titulo AS item_titulo,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         e.nome AS responsavel_nome,
         fp.id AS fvs_planejada_id,
         o.id AS obra_id, a.id AS ambiente_id,
         n.data_nova_verif AS prazo_correcao
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v        ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp     ON fp.id = v.fvs_planejada_id
  JOIN ambientes a           ON a.id = fp.ambiente_id
  JOIN obras o               ON o.id = a.obra_id
  LEFT JOIN equipes e        ON e.id = n.responsavel_id
  WHERE n.status != 'cancelada'
  ORDER BY n.data_nova_verif ASC NULLS LAST;
$$;