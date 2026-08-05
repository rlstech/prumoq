-- Funções SECURITY DEFINER de gatilhos não devem ficar expostas via RPC.
REVOKE ALL ON FUNCTION refresh_obra_feature_flags() FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_stage_weights() FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_avanco_aprovado_servico() FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_nc_financeiro() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_nc_financeiro() FROM PUBLIC;
REVOKE ALL ON FUNCTION criar_modelos_medicao_empresa(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION trg_criar_modelos_medicao_empresa() FROM PUBLIC;
REVOKE ALL ON FUNCTION aprovar_medicao_servico(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancelar_medicao_servico(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION trocar_empreiteiro_servico(uuid, uuid, date, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION aprovar_medicao_servico(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancelar_medicao_servico(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION trocar_empreiteiro_servico(uuid, uuid, date, text) TO authenticated;
