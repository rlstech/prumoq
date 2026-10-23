-- `obra_equipes` models current associations and has no `ativo` column. The
-- previous migration accidentally used the status column from `obra_usuarios`.
-- Rebuild only the two affected function definitions, removing that predicate.
DO $$
DECLARE
  v_signature regprocedure;
  v_definition text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.salvar_medicao_rascunho(uuid,uuid,uuid,text,date,date,date,text,jsonb)'::regprocedure,
    'public.trocar_empreiteiro_servico(uuid,uuid,date,text)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(v_signature) INTO v_definition;
    v_definition := replace(v_definition, ' AND ativo)', ')');
    EXECUTE v_definition;
  END LOOP;
END
$$;
