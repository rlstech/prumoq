-- RPC para buscar dados do cabeçalho de uma FVS para geração de relatório PDF.
-- Retorna info da obra, empresa, ambiente e FVS em uma única chamada.

CREATE OR REPLACE FUNCTION get_fvs_header(p_fvs_id uuid)
RETURNS TABLE(
  obra_nome            text,
  obra_municipio       text,
  obra_uf              text,
  obra_endereco        text,
  obra_eng_responsavel text,
  obra_crea_cau        text,
  empresa_nome         text,
  ambiente_nome        text,
  ambiente_tipo        text,
  ambiente_localizacao text,
  fvs_subservico       text,
  fvs_status           text,
  fvs_revisao          text,
  fvs_concluida_em     timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT
    o.nome, o.municipio, o.uf, o.endereco,
    o.eng_responsavel, o.crea_cau,
    e.nome,
    a.nome, a.tipo::text, a.localizacao,
    fp.subservico, fp.status::text, fp.revisao_associada::text, fp.concluida_em
  FROM fvs_planejadas fp
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o ON o.id = a.obra_id
  LEFT JOIN empresas e ON e.id = o.empresa_id
  WHERE fp.id = p_fvs_id;
$$;
