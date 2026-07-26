-- Evita duplicar a foto legada de reinspeção quando a NC já possui registros
-- na tabela nc_reinspecoes. Mantém a assinatura pública da RPC da migration 021.

CREATE OR REPLACE FUNCTION get_fvs_attachments(p_fvs_id uuid)
RETURNS TABLE (
  id uuid,
  verificacao_id uuid,
  r2_key text,
  ordem integer,
  kind text,
  label text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH target_fvs AS (
    SELECT fp.id, o.id AS obra_id, o.empresa_id
    FROM fvs_planejadas fp
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    WHERE fp.id = p_fvs_id
      AND EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid()
          AND (
            (
              u.perfil IN ('admin', 'gestor')
              AND u.empresa_id = o.empresa_id
            )
            OR EXISTS (
              SELECT 1
              FROM obra_usuarios ou
              WHERE ou.obra_id = o.id
                AND ou.usuario_id = auth.uid()
                AND ou.ativo = true
            )
          )
      )
  ),
  report_verifications AS (
    SELECT v.id
    FROM verificacoes v
    JOIN target_fvs tf ON tf.id = v.fvs_planejada_id
  ),
  report_ncs AS (
    SELECT nc.id, nc.verificacao_id, nc.descricao, nc.foto_reinspecao_url
    FROM nao_conformidades nc
    JOIN report_verifications rv ON rv.id = nc.verificacao_id
  )
  SELECT
    vf.id,
    vf.verificacao_id,
    vf.r2_key,
    vf.ordem,
    'verification'::text AS kind,
    'Evidência da verificação'::text AS label
  FROM verificacao_fotos vf
  JOIN report_verifications rv ON rv.id = vf.verificacao_id

  UNION ALL

  SELECT
    nf.id,
    nc.verificacao_id,
    nf.r2_key,
    nf.ordem,
    'nc'::text AS kind,
    'Não conformidade: ' || left(nc.descricao, 100) AS label
  FROM nc_fotos nf
  JOIN report_ncs nc ON nc.id = nf.nc_id

  UNION ALL

  SELECT
    nr.id,
    nc.verificacao_id,
    nr.foto_url,
    0,
    'reinspection'::text AS kind,
    'Reinspeção da não conformidade'::text AS label
  FROM nc_reinspecoes nr
  JOIN report_ncs nc ON nc.id = nr.nc_id
  WHERE nr.foto_url IS NOT NULL

  UNION ALL

  SELECT
    nc.id,
    nc.verificacao_id,
    nc.foto_reinspecao_url,
    0,
    'reinspection'::text AS kind,
    'Reinspeção da não conformidade'::text AS label
  FROM report_ncs nc
  WHERE nc.foto_reinspecao_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM nc_reinspecoes nr
      WHERE nr.nc_id = nc.id
    )

  ORDER BY verificacao_id, kind, ordem, id;
$$;

REVOKE ALL ON FUNCTION get_fvs_attachments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_fvs_attachments(uuid) TO authenticated;
