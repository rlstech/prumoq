-- Security hardening: inspection records are append-only for inspectors and
-- persisted media references must be tenant-scoped R2 object keys.

CREATE OR REPLACE FUNCTION public.can_edit_verificacao(p_verificacao_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.verificacoes v
    WHERE v.id = p_verificacao_id
      AND public.has_verificacao_access(v.id)
      AND (
        v.inspetor_id = auth.uid()
        OR public.get_perfil() IN ('admin', 'gestor')
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_edit_verificacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_verificacao(uuid) TO authenticated;

-- Reading remains scoped by obra. Writes are no longer implicitly granted to
-- every inspector who can read a record from that obra.
DROP POLICY IF EXISTS verificacoes_tenant ON public.verificacoes;
DROP POLICY IF EXISTS verificacoes_write ON public.verificacoes;
CREATE POLICY verificacoes_select ON public.verificacoes FOR SELECT
  USING (public.has_verificacao_access(id));
CREATE POLICY verificacoes_insert ON public.verificacoes FOR INSERT
  WITH CHECK (
    public.has_fvs_access(fvs_planejada_id)
    AND inspetor_id = auth.uid()
  );
CREATE POLICY verificacoes_update ON public.verificacoes FOR UPDATE
  USING (public.can_edit_verificacao(id))
  WITH CHECK (
    public.has_fvs_access(fvs_planejada_id)
    AND (
      inspetor_id = auth.uid()
      OR (
        public.get_perfil() IN ('admin', 'gestor')
        AND EXISTS (
          SELECT 1 FROM public.usuarios u
          WHERE u.id = inspetor_id
            AND u.cliente_id = public.get_cliente_id()
            AND u.ativo
        )
      )
    )
  );

DROP POLICY IF EXISTS verificacao_itens_tenant ON public.verificacao_itens;
CREATE POLICY verificacao_itens_select ON public.verificacao_itens FOR SELECT
  USING (public.has_verificacao_access(verificacao_id));
CREATE POLICY verificacao_itens_insert ON public.verificacao_itens FOR INSERT
  WITH CHECK (public.can_edit_verificacao(verificacao_id));
CREATE POLICY verificacao_itens_update ON public.verificacao_itens FOR UPDATE
  USING (public.can_edit_verificacao(verificacao_id))
  WITH CHECK (public.can_edit_verificacao(verificacao_id));

DROP POLICY IF EXISTS verificacao_fotos_tenant ON public.verificacao_fotos;
CREATE POLICY verificacao_fotos_select ON public.verificacao_fotos FOR SELECT
  USING (public.has_verificacao_access(verificacao_id));
CREATE POLICY verificacao_fotos_insert ON public.verificacao_fotos FOR INSERT
  WITH CHECK (public.can_edit_verificacao(verificacao_id));

DROP POLICY IF EXISTS nc_tenant ON public.nao_conformidades;
CREATE POLICY nc_select ON public.nao_conformidades FOR SELECT
  USING (public.has_verificacao_access(verificacao_id));
CREATE POLICY nc_insert ON public.nao_conformidades FOR INSERT
  WITH CHECK (public.can_edit_verificacao(verificacao_id));

DROP POLICY IF EXISTS nc_fotos_tenant ON public.nc_fotos;
CREATE POLICY nc_fotos_select ON public.nc_fotos FOR SELECT
  USING (public.has_nc_access(nc_id));
CREATE POLICY nc_fotos_insert ON public.nc_fotos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nao_conformidades nc
      WHERE nc.id = nc_id
        AND public.can_edit_verificacao(nc.verificacao_id)
    )
  );

DROP POLICY IF EXISTS nc_reinspecoes_tenant ON public.nc_reinspecoes;
DROP POLICY IF EXISTS nc_reinspecoes_insert ON public.nc_reinspecoes;
CREATE POLICY nc_reinspecoes_select ON public.nc_reinspecoes FOR SELECT
  USING (public.has_nc_access(nc_id));
CREATE POLICY nc_reinspecoes_insert ON public.nc_reinspecoes FOR INSERT
  WITH CHECK (
    inspetor_id = auth.uid()
    AND public.can_edit_verificacao(verificacao_id)
    AND EXISTS (
      SELECT 1
      FROM public.nao_conformidades nc
      JOIN public.verificacoes origem ON origem.id = nc.verificacao_id
      JOIN public.verificacoes reinspecao ON reinspecao.id = verificacao_id
      WHERE nc.id = nc_id
        AND origem.fvs_planejada_id = reinspecao.fvs_planejada_id
    )
  );

-- Reinspection is the only authenticated path allowed to change an existing
-- NC. The trigger is SECURITY DEFINER so PowerSync can remain offline-first.
CREATE OR REPLACE FUNCTION public.apply_nc_reinspecao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_origem_fvs uuid;
  v_reinspecao_fvs uuid;
BEGIN
  SELECT v.fvs_planejada_id INTO v_origem_fvs
  FROM public.nao_conformidades nc
  JOIN public.verificacoes v ON v.id = nc.verificacao_id
  WHERE nc.id = NEW.nc_id
  FOR UPDATE;

  SELECT v.fvs_planejada_id INTO v_reinspecao_fvs
  FROM public.verificacoes v
  WHERE v.id = NEW.verificacao_id
    AND v.inspetor_id = NEW.inspetor_id;

  IF v_origem_fvs IS NULL OR v_reinspecao_fvs IS NULL
    OR v_origem_fvs <> v_reinspecao_fvs
    OR NEW.inspetor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Reinspeção fora do escopo autorizado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.resultado = 'aprovada' THEN
    UPDATE public.nao_conformidades
    SET status = 'resolvida',
        resolvida_em = NEW.created_at,
        verificacao_reinsp_id = NEW.verificacao_id,
        foto_reinspecao_url = NEW.foto_url,
        updated_at = now()
    WHERE id = NEW.nc_id;
  ELSIF NEW.resultado = 'reprovada' THEN
    UPDATE public.nao_conformidades
    SET status = 'encerrada_sem_resolucao', updated_at = now()
    WHERE id = NEW.nc_id;
  ELSE
    RAISE EXCEPTION 'Resultado de reinspeção inválido' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_nc_reinspecao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_apply_nc_reinspecao ON public.nc_reinspecoes;
CREATE TRIGGER trg_apply_nc_reinspecao
AFTER INSERT ON public.nc_reinspecoes
FOR EACH ROW EXECUTE FUNCTION public.apply_nc_reinspecao();

CREATE OR REPLACE FUNCTION public.is_tenant_media_key(p_key text, p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_key ~ ('^fotos/' || p_cliente_id::text || '/[0-9a-f-]{36}/.+')
$$;

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
    'r2_key', 'r2_thumb_key', 'assinatura_url', 'foto_url',
    'foto_reinspecao_url', 'documento_financeiro_r2_key'
  ] LOOP
    v_value := v_new ->> v_field;
    v_old_value := v_old ->> v_field;
    IF v_value IS NULL OR (TG_OP = 'UPDATE' AND v_value IS NOT DISTINCT FROM v_old_value) THEN
      CONTINUE;
    END IF;
    IF NOT public.is_tenant_media_key(v_value, NEW.cliente_id) THEN
      RAISE EXCEPTION 'Referência de mídia inválida para o cliente'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.is_tenant_media_key(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_tenant_media_reference() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'verificacoes', 'verificacao_fotos', 'nc_fotos', 'nc_reinspecoes',
    'nao_conformidades', 'fvs_conclusoes'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_media_reference ON public.%I', v_table, v_table);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_media_reference BEFORE INSERT OR UPDATE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_media_reference()',
      v_table, v_table
    );
  END LOOP;
END;
$$;
