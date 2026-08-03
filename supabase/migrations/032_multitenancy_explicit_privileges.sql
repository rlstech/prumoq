-- Supabase default privileges may grant functions explicitly to anon/authenticated.
-- Remove anonymous RPC access and keep trigger-only functions non-callable.

REVOKE ALL ON FUNCTION get_cliente_id() FROM anon;
REVOKE ALL ON FUNCTION get_perfil() FROM anon;
REVOKE ALL ON FUNCTION is_platform_admin() FROM anon;
REVOKE ALL ON FUNCTION has_cliente_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION has_obra_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION has_ambiente_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION has_fvs_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION has_verificacao_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION has_nc_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION get_clientes_resumo() FROM anon;
REVOKE ALL ON FUNCTION get_accessible_media_keys(text[]) FROM anon;

REVOKE ALL ON FUNCTION enforce_cliente_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION validate_resource_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_row_cliente_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION validate_cliente_limits() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'clientes', 'auditoria_plataforma', 'empresas', 'usuarios', 'obras',
        'obra_usuarios', 'obra_equipes', 'equipes', 'equipe_empresas',
        'fvs_padrao', 'fvs_padrao_empresas', 'fvs_padrao_revisoes',
        'fvs_padrao_itens', 'ambientes', 'fvs_planejadas', 'verificacoes',
        'verificacao_itens', 'verificacao_fotos', 'nao_conformidades',
        'nc_fotos', 'nc_reinspecoes', 'fvs_conclusoes', 'fvs_reaberturas'
      )
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      policy_record.policyname, policy_record.schemaname, policy_record.tablename
    );
  END LOOP;
END
$$;
