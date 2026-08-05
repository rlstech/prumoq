DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'modelos_etapas_medicao','modelo_etapas_medicao_itens',
    'fvs_medicao_configuracoes','fvs_medicao_etapas',
    'vinculos_execucao_servico','avancos_aprovados_servico',
    'medicoes_servico','medicao_servico_itens','medicao_item_liberacoes',
    'auditoria_operacional','nc_financeiro_historico'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',v_table);
  END LOOP;
END
$$;

REVOKE ALL ON TABLE public.vw_saldos_medicao_servico,
  public.vw_indicadores_medicoes FROM anon;

-- Admin mutations are performed only through checked SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.modelos_etapas_medicao,
  public.modelo_etapas_medicao_itens,
  public.fvs_medicao_configuracoes,
  public.fvs_medicao_etapas,
  public.vinculos_execucao_servico,
  public.medicoes_servico,
  public.medicao_servico_itens,
  public.medicao_item_liberacoes,
  public.auditoria_operacional,
  public.nc_financeiro_historico
FROM authenticated;

-- Native offline sync inserts approved advances directly. Existing advances
-- remain immutable; an identical UPDATE is allowed only for idempotent upsert.
CREATE OR REPLACE FUNCTION public.proteger_historico_avanco_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Avanços aprovados não podem ser excluídos' USING ERRCODE='check_violation';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Avanços aprovados não podem ser alterados' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_proteger_historico_avanco_aprovado
  ON public.avancos_aprovados_servico;
CREATE TRIGGER trg_proteger_historico_avanco_aprovado
BEFORE UPDATE OR DELETE ON public.avancos_aprovados_servico
FOR EACH ROW EXECUTE FUNCTION public.proteger_historico_avanco_aprovado();

REVOKE ALL ON FUNCTION public.proteger_historico_avanco_aprovado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_alocacao_liberacao_medicao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fvs_medicao_obra(uuid) FROM anon;
