-- Funções de trigger são apenas implementação interna; não podem formar uma
-- superfície RPC para usuários autenticados.
REVOKE ALL ON FUNCTION validate_medicao_feature_enabled() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION validate_medicao_item_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION protect_medicao_history() FROM PUBLIC, anon, authenticated;
