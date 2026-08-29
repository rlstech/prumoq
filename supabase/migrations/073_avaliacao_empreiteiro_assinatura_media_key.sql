-- Signatures of contractor evaluations live in R2 as plain object keys
-- (fotos/<cliente_id>/<user_id>/...). The download whitelist used by
-- r2-presign (get_accessible_media_keys) was created before the evaluation
-- feature (064), so asking for an evaluation signature produced
-- 403 "Media access denied" and every evaluation PDF returned 500.
-- Add the table to the whitelist; RLS (has_obra_access via
-- avaliacoes_empreiteiro_select) keeps the resolution scoped to obras the
-- caller can already see in the panel.

CREATE OR REPLACE FUNCTION public.get_accessible_media_keys(p_keys text[])
RETURNS SETOF text
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT key FROM (
    SELECT vf.r2_key AS key FROM verificacao_fotos vf WHERE vf.r2_key = ANY(p_keys)
    UNION SELECT vf.r2_thumb_key FROM verificacao_fotos vf WHERE vf.r2_thumb_key = ANY(p_keys)
    UNION SELECT nf.r2_key FROM nc_fotos nf WHERE nf.r2_key = ANY(p_keys)
    UNION SELECT nf.r2_thumb_key FROM nc_fotos nf WHERE nf.r2_thumb_key = ANY(p_keys)
    UNION SELECT v.assinatura_url FROM verificacoes v WHERE v.assinatura_url = ANY(p_keys)
    UNION SELECT fc.assinatura_url FROM fvs_conclusoes fc WHERE fc.assinatura_url = ANY(p_keys)
    UNION SELECT nr.foto_url FROM nc_reinspecoes nr WHERE nr.foto_url = ANY(p_keys)
    UNION SELECT nc.foto_reinspecao_url FROM nao_conformidades nc WHERE nc.foto_reinspecao_url = ANY(p_keys)
    UNION SELECT u.assinatura_padrao_url FROM usuarios u
      WHERE u.id = auth.uid() AND u.assinatura_padrao_url = ANY(p_keys)
    UNION SELECT ae.assinatura_url FROM avaliacoes_empreiteiro ae
      WHERE ae.assinatura_url = ANY(p_keys)
  ) media WHERE key IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_accessible_media_keys(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accessible_media_keys(text[]) TO authenticated;
