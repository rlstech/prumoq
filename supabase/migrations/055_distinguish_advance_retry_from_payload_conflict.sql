-- A duplicate UUID with different contents must not look like the harmless
-- unique violation used by the offline connector to acknowledge retries.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.validate_avanco_aprovado_servico()'::regprocedure
  ) INTO v_definition;
  v_definition:=replace(
    v_definition,
    'O identificador do avanço já existe com outros dados'' USING ERRCODE = ''unique_violation''',
    'O identificador do avanço já existe com outros dados'' USING ERRCODE = ''check_violation'''
  );
  EXECUTE v_definition;
END
$$;
