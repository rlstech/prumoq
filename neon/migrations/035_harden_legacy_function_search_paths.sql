-- Fixa o search_path das funcoes legadas sinalizadas pelo Security Advisor.
-- Mantemos public e extensions para compatibilidade com as implementacoes
-- existentes, acrescentando pg_temp por ultimo para evitar shadowing.

DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'apply_fvs_conclusao',
        'apply_fvs_reabertura',
        'bump_fvs_conclusao_counter',
        'bump_fvs_reabertura_counter',
        'get_ambientes_obra',
        'get_fotos_fvs',
        'get_fvs_ambiente',
        'get_fvs_detalhe',
        'get_fvs_header',
        'get_itens_checklist',
        'get_ncs_abertas_inspetor',
        'get_ncs_full',
        'get_ncs_fvs',
        'get_ncs_urgentes',
        'get_obra_kpi',
        'get_obras_acesso',
        'get_obras_com_fvs',
        'get_obras_progresso_dashboard',
        'get_usuarios_com_obras',
        'get_verificacoes_fvs',
        'get_verificacoes_recentes',
        'next_numero_verif',
        'set_updated_at',
        'update_fvs_status',
        'validate_fvs_conclusao'
      ])
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, extensions, pg_temp',
      v_function
    );
  END LOOP;
END;
$$;
