-- O status da etapa e a trilha de auditoria devem acompanhar todo avanço
-- aprovado, independente do caminho de escrita (upload PowerSync, shim web ou
-- RPC). Move a lógica para um trigger AFTER INSERT; registrar_avanco_aprovado
-- passa a delegar ao trigger.

CREATE OR REPLACE FUNCTION public.atualizar_etapa_medicao_ao_aprovar_avanco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.vinculos_execucao_servico%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.vinculos_execucao_servico WHERE id = NEW.vinculacao_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v.etapa_id IS NOT NULL THEN
    UPDATE public.fvs_medicao_etapas
    SET status = CASE
        WHEN NEW.aprovado_atual >= v.escopo_atribuido THEN 'aprovada'::public.status_etapa_medicao
        WHEN NEW.executado_atual >= v.escopo_atribuido THEN 'concluida'::public.status_etapa_medicao
        WHEN NEW.executado_atual > 0 THEN 'em_execucao'::public.status_etapa_medicao
        ELSE 'nao_iniciada'::public.status_etapa_medicao
      END,
      percentual_interno = least(100, (NEW.aprovado_atual / nullif(v.escopo_atribuido, 0)) * 100),
      equipe_responsavel_id = v.equipe_id,
      verificacao_evidencia_id = NEW.verificacao_id,
      updated_by = NEW.aprovado_por,
      updated_at = now()
    WHERE id = v.etapa_id;
  END IF;

  INSERT INTO public.auditoria_operacional(cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (
    NEW.cliente_id,
    public.fvs_medicao_obra(v.fvs_planejada_id),
    'avanco_aprovado',
    NEW.id,
    'aprovado',
    jsonb_build_object('executado', NEW.executado_atual, 'aprovado', NEW.aprovado_atual),
    NEW.aprovado_por
  );

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_avanco_atualiza_etapa_medicao ON public.avancos_aprovados_servico;
CREATE TRIGGER trg_avanco_atualiza_etapa_medicao
AFTER INSERT ON public.avancos_aprovados_servico
FOR EACH ROW EXECUTE FUNCTION public.atualizar_etapa_medicao_ao_aprovar_avanco();

REVOKE ALL ON FUNCTION public.atualizar_etapa_medicao_ao_aprovar_avanco() FROM PUBLIC, anon, authenticated;

-- A atualização de etapa e a auditoria agora acontecem no trigger acima;
-- a RPC apenas registra o avanço (as validações seguem no trigger BEFORE INSERT).
CREATE OR REPLACE FUNCTION public.registrar_avanco_aprovado(
  p_id uuid, p_vinculo_id uuid, p_verificacao_id uuid,
  p_executado_atual numeric, p_aprovado_atual numeric, p_created_offline boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v public.vinculos_execucao_servico%ROWTYPE;
  v_prev record;
  v_unidade text;
  v_id uuid := COALESCE(p_id, public.uuid_generate_v4());
BEGIN
  SELECT * INTO v FROM public.vinculos_execucao_servico WHERE id = p_vinculo_id FOR UPDATE;
  IF NOT FOUND OR public.get_perfil() NOT IN ('admin','gestor','inspetor') OR NOT public.has_fvs_access(v.fvs_planejada_id) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar avanço' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v.status <> 'ativo' THEN RAISE EXCEPTION 'O vínculo de execução não está ativo' USING ERRCODE = 'check_violation'; END IF;
  SELECT executado_atual, aprovado_atual INTO v_prev FROM public.avancos_aprovados_servico
    WHERE vinculacao_id = v.id ORDER BY data_aprovacao DESC, created_at DESC LIMIT 1;
  SELECT unidade INTO v_unidade FROM public.fvs_medicao_configuracoes WHERE fvs_planejada_id = v.fvs_planejada_id;
  INSERT INTO public.avancos_aprovados_servico(
    id, cliente_id, vinculacao_id, verificacao_id, etapa_id,
    executado_anterior, executado_atual, aprovado_anterior, aprovado_atual,
    unidade, aprovado_por, created_offline
  ) VALUES (
    v_id, v.cliente_id, v.id, p_verificacao_id, v.etapa_id,
    COALESCE(v_prev.executado_atual, 0), p_executado_atual,
    COALESCE(v_prev.aprovado_atual, 0), p_aprovado_atual,
    v_unidade, auth.uid(), p_created_offline
  );
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_avanco_aprovado(uuid,uuid,uuid,numeric,numeric,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_avanco_aprovado(uuid,uuid,uuid,numeric,numeric,boolean) TO authenticated;
