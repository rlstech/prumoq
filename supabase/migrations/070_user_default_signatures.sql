-- Reusable visual signature. Documents keep their own R2 snapshots, so this
-- key is only the source used for future signatures.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS assinatura_padrao_url text,
  ADD COLUMN IF NOT EXISTS assinatura_padrao_atualizada_em timestamptz;

CREATE OR REPLACE FUNCTION public.validate_tenant_media_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_field text;
  v_value text;
  v_old_value text;
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  FOREACH v_field IN ARRAY ARRAY[
    'r2_key', 'r2_thumb_key', 'assinatura_url', 'assinatura_padrao_url',
    'foto_url', 'foto_reinspecao_url', 'documento_financeiro_r2_key'
  ] LOOP
    v_value := v_new ->> v_field;
    v_old_value := v_old ->> v_field;
    IF v_value IS NULL OR (TG_OP = 'UPDATE' AND v_value IS NOT DISTINCT FROM v_old_value) THEN CONTINUE; END IF;
    IF NOT public.is_tenant_media_key(v_value, NEW.cliente_id) THEN
      RAISE EXCEPTION 'Referência de mídia inválida para o cliente' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE POLICY usuarios_assinatura_padrao_propria ON public.usuarios
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND cliente_id = get_cliente_id());

CREATE OR REPLACE FUNCTION public.protect_usuario_self_service_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() = OLD.id AND get_perfil() <> 'admin' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.cargo IS DISTINCT FROM OLD.cargo
       OR NEW.telefone IS DISTINCT FROM OLD.telefone
       OR NEW.perfil IS DISTINCT FROM OLD.perfil
       OR NEW.ativo IS DISTINCT FROM OLD.ativo
       OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
       OR NEW.onboarding_concluido_em IS DISTINCT FROM OLD.onboarding_concluido_em THEN
      RAISE EXCEPTION 'Apenas a assinatura padrão pode ser atualizada pelo próprio usuário'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_usuario_self_service_fields ON public.usuarios;
CREATE TRIGGER trg_protect_usuario_self_service_fields
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.protect_usuario_self_service_fields();

REVOKE ALL ON FUNCTION public.protect_usuario_self_service_fields() FROM PUBLIC, anon, authenticated;

-- Uses the same tenant key validation as all inspection media.
DROP TRIGGER IF EXISTS trg_usuarios_media_reference ON public.usuarios;
CREATE TRIGGER trg_usuarios_media_reference
  BEFORE INSERT OR UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_media_reference();

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
  ) media WHERE key IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_accessible_media_keys(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accessible_media_keys(text[]) TO authenticated;
