-- Helpers for secure INSERT checks where the child row does not exist yet.

CREATE OR REPLACE FUNCTION has_ambiente_access(p_ambiente_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ambientes a
    WHERE a.id = p_ambiente_id AND has_obra_access(a.obra_id)
  )
$$;

REVOKE ALL ON FUNCTION has_ambiente_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_ambiente_access(uuid) TO authenticated;

DROP POLICY IF EXISTS ambientes_manage ON ambientes;
CREATE POLICY ambientes_manage ON ambientes FOR ALL
  USING (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'));

DROP POLICY IF EXISTS fvs_planejadas_manage ON fvs_planejadas;
CREATE POLICY fvs_planejadas_manage ON fvs_planejadas FOR ALL
  USING (has_fvs_access(id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_ambiente_access(ambiente_id) AND get_perfil() IN ('admin', 'gestor'));

-- Recreate the only SECURITY DEFINER report RPC that referenced the former
-- usuarios.empresa_id tenant boundary.
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
SET search_path = public, pg_temp
AS $$
  WITH target_fvs AS (
    SELECT fp.id
    FROM fvs_planejadas fp
    WHERE fp.id = p_fvs_id AND has_fvs_access(fp.id)
  ),
  report_verifications AS (
    SELECT v.id FROM verificacoes v
    JOIN target_fvs tf ON tf.id = v.fvs_planejada_id
  ),
  report_ncs AS (
    SELECT nc.id, nc.verificacao_id, nc.descricao, nc.foto_reinspecao_url
    FROM nao_conformidades nc
    JOIN report_verifications rv ON rv.id = nc.verificacao_id
  )
  SELECT vf.id, vf.verificacao_id, vf.r2_key, vf.ordem,
    'verification'::text, 'Evidência da verificação'::text
  FROM verificacao_fotos vf JOIN report_verifications rv ON rv.id = vf.verificacao_id
  UNION ALL
  SELECT nf.id, nc.verificacao_id, nf.r2_key, nf.ordem,
    'nc'::text, 'Não conformidade: ' || left(nc.descricao, 100)
  FROM nc_fotos nf JOIN report_ncs nc ON nc.id = nf.nc_id
  UNION ALL
  SELECT nr.id, nc.verificacao_id, nr.foto_url, 0,
    'reinspection'::text, 'Reinspeção da não conformidade'::text
  FROM nc_reinspecoes nr JOIN report_ncs nc ON nc.id = nr.nc_id
  WHERE nr.foto_url IS NOT NULL
  UNION ALL
  SELECT nc.id, nc.verificacao_id, nc.foto_reinspecao_url, 0,
    'reinspection'::text, 'Reinspeção da não conformidade'::text
  FROM report_ncs nc
  WHERE nc.foto_reinspecao_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM nc_reinspecoes nr
      WHERE nr.nc_id = nc.id AND nr.foto_url = nc.foto_reinspecao_url
    )
  ORDER BY 2, 5, 4, 1;
$$;

REVOKE ALL ON FUNCTION get_fvs_attachments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_fvs_attachments(uuid) TO authenticated;
