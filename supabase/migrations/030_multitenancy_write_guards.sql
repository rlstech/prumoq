-- Defense in depth for writes coming from PowerSync and older clients.
-- Explicit cross-tenant values are rejected; omitted values inherit the
-- authenticated user's tenant before NOT NULL and RLS checks run.

CREATE OR REPLACE FUNCTION enforce_row_cliente_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_cliente uuid := get_cliente_id();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF caller_cliente IS NULL THEN
    RAISE EXCEPTION 'Usuário sem cliente operacional' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.cliente_id IS NULL THEN
    NEW.cliente_id := caller_cliente;
  ELSIF NEW.cliente_id <> caller_cliente THEN
    RAISE EXCEPTION 'Tentativa de gravação fora do cliente' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION enforce_row_cliente_id() FROM PUBLIC;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'empresas', 'equipes', 'fvs_padrao', 'obras', 'obra_usuarios',
    'obra_equipes', 'ambientes', 'fvs_padrao_revisoes', 'fvs_padrao_itens',
    'fvs_planejadas', 'verificacoes', 'verificacao_itens', 'verificacao_fotos',
    'nao_conformidades', 'nc_fotos', 'nc_reinspecoes', 'fvs_conclusoes',
    'fvs_reaberturas', 'equipe_empresas', 'fvs_padrao_empresas'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF cliente_id ON %I '
      || 'FOR EACH ROW EXECUTE FUNCTION enforce_row_cliente_id()',
      'trg_' || table_name || '_cliente_guard', table_name
    );
  END LOOP;
END
$$;

GRANT SELECT ON clientes TO authenticated;
GRANT SELECT ON auditoria_plataforma TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON equipe_empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fvs_padrao_empresas TO authenticated;

CREATE OR REPLACE FUNCTION validate_cliente_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.limite_usuarios IS NOT NULL AND NEW.limite_usuarios < (
    SELECT count(*) FROM usuarios WHERE cliente_id = NEW.id AND ativo
  ) THEN RAISE EXCEPTION 'Limite de usuários menor que o consumo atual' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.limite_empresas IS NOT NULL AND NEW.limite_empresas < (
    SELECT count(*) FROM empresas WHERE cliente_id = NEW.id AND ativo
  ) THEN RAISE EXCEPTION 'Limite de empresas menor que o consumo atual' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.limite_obras IS NOT NULL AND NEW.limite_obras < (
    SELECT count(*) FROM obras WHERE cliente_id = NEW.id AND ativo
  ) THEN RAISE EXCEPTION 'Limite de obras menor que o consumo atual' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION validate_cliente_limits() FROM PUBLIC;
CREATE TRIGGER trg_clientes_validate_limits
  BEFORE INSERT OR UPDATE OF limite_usuarios, limite_empresas, limite_obras ON clientes
  FOR EACH ROW EXECUTE FUNCTION validate_cliente_limits();
