-- PostgreSQL runs BEFORE INSERT triggers before resolving ON CONFLICT. Detect
-- an already-persisted, identical PowerSync PUT before validating its previous
-- accumulated values against itself.
DO $$
DECLARE
  v_definition text;
  v_marker text := '  -- PowerSync retries PUT operations as UPSERT.';
  v_guard text := $guard$  IF TG_OP='INSERT' AND EXISTS(
    SELECT 1 FROM public.avancos_aprovados_servico existing WHERE existing.id=NEW.id
  ) THEN
    IF EXISTS(
      SELECT 1 FROM public.avancos_aprovados_servico existing
      WHERE existing.id=NEW.id AND existing=NEW
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'O identificador do avanço já existe com outros dados'
      USING ERRCODE='unique_violation';
  END IF;

$guard$;
BEGIN
  SELECT pg_get_functiondef(
    'public.validate_avanco_aprovado_servico()'::regprocedure
  ) INTO v_definition;
  IF strpos(v_definition,v_marker)=0 THEN
    RAISE EXCEPTION 'Marcador da função de avanço não encontrado';
  END IF;
  v_definition:=replace(v_definition,v_marker,v_guard||v_marker);
  EXECUTE v_definition;
END
$$;
