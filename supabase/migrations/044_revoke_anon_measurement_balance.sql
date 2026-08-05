-- saldo_vinculo_execucao é exposta por uma view autenticada; não há motivo
-- para permitir execução anônima da função auxiliar.
REVOKE ALL ON FUNCTION saldo_vinculo_execucao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION saldo_vinculo_execucao(uuid) TO authenticated;
