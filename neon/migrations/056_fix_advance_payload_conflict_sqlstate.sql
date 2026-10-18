DO $$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.validate_avanco_aprovado_servico()'::regprocedure)
    INTO v_definition;
  v_definition:=replace(
    v_definition,
    'USING ERRCODE=''unique_violation'';',
    'USING ERRCODE=''check_violation'';'
  );
  EXECUTE v_definition;
END
$$;
