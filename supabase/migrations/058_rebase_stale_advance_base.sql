-- Substitui a rejeição por serialization_failure (053) por rebase automático:
-- o cliente informa os totais que conhece; o servidor deriva o delta
-- (atual - anterior recebidos) e o ancora no último saldo real do vínculo.
-- Avanços concorrentes registrados offline passam a se encadear na ordem de
-- chegada, em vez de ficarem presos na fila de sincronização (RN-09).
-- Preserva o guard de retry idempotente do PowerSync (054/055/056) e as
-- demais validações, agora aplicadas sobre os totais JÁ rebaseados.

CREATE OR REPLACE FUNCTION public.validate_avanco_aprovado_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.vinculos_execucao_servico%ROWTYPE;
  v_ultimo public.avancos_aprovados_servico%ROWTYPE;
  v_verificacao record;
  v_habilitado boolean;
  v_delta_executado numeric;
  v_delta_aprovado numeric;
BEGIN
  -- PowerSync retries PUT operations as UPSERT. Permit only a byte-for-byte
  -- equivalent conflict update; all historical changes remain forbidden.
  IF TG_OP = 'UPDATE' THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Avanços aprovados não podem ser alterados' USING ERRCODE = 'check_violation';
  END IF;

  -- PostgreSQL runs BEFORE INSERT triggers before resolving ON CONFLICT.
  -- Detect an already-persisted, identical PowerSync PUT before validating.
  IF EXISTS(SELECT 1 FROM public.avancos_aprovados_servico existing WHERE existing.id = NEW.id) THEN
    IF EXISTS(
      SELECT 1 FROM public.avancos_aprovados_servico existing
      WHERE existing.id = NEW.id AND existing = NEW
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'O identificador do avanço já existe com outros dados'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v FROM public.vinculos_execucao_servico
  WHERE id = NEW.vinculacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo de execução não encontrado' USING ERRCODE = 'check_violation';
  END IF;
  SELECT fvs_planejada_id, equipe_id INTO v_verificacao
  FROM public.verificacoes WHERE id = NEW.verificacao_id;
  IF NOT FOUND OR v.fvs_planejada_id <> v_verificacao.fvs_planejada_id THEN
    RAISE EXCEPTION 'Avanço não pertence ao serviço da verificação' USING ERRCODE = 'check_violation';
  END IF;
  IF v.status <> 'ativo' THEN
    RAISE EXCEPTION 'Somente o vínculo de execução ativo pode receber novo avanço' USING ERRCODE = 'check_violation';
  END IF;
  IF v_verificacao.equipe_id IS NULL OR v_verificacao.equipe_id <> v.equipe_id THEN
    RAISE EXCEPTION 'A verificação deve creditar o empreiteiro que executou o serviço' USING ERRCODE = 'check_violation';
  END IF;
  SELECT controle_medicoes_efetivo INTO v_habilitado FROM public.obras
  WHERE id = public.fvs_medicao_obra(v.fvs_planejada_id);
  IF NOT v_habilitado THEN
    RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE = 'check_violation';
  END IF;

  NEW.cliente_id := v.cliente_id;
  NEW.etapa_id := v.etapa_id;
  SELECT unidade INTO NEW.unidade FROM public.fvs_medicao_configuracoes
  WHERE fvs_planejada_id = v.fvs_planejada_id;
  IF auth.uid() IS NOT NULL THEN NEW.aprovado_por := auth.uid(); END IF;

  -- Delta informado pelo cliente sobre a base que ele conhecia.
  v_delta_executado := NEW.executado_atual - NEW.executado_anterior;
  v_delta_aprovado := NEW.aprovado_atual - NEW.aprovado_anterior;
  IF v_delta_executado < 0 OR v_delta_aprovado < 0 THEN
    RAISE EXCEPTION 'O avanço acumulado não pode ser reduzido' USING ERRCODE = 'check_violation';
  END IF;

  -- Rebase: ancora o delta no último saldo real do vínculo.
  SELECT * INTO v_ultimo FROM public.avancos_aprovados_servico
  WHERE vinculacao_id = NEW.vinculacao_id
  ORDER BY data_aprovacao DESC, created_at DESC LIMIT 1;
  IF FOUND THEN
    NEW.executado_anterior := v_ultimo.executado_atual;
    NEW.aprovado_anterior := v_ultimo.aprovado_atual;
  ELSE
    NEW.executado_anterior := 0;
    NEW.aprovado_anterior := 0;
  END IF;
  NEW.executado_atual := NEW.executado_anterior + v_delta_executado;
  NEW.aprovado_atual := NEW.aprovado_anterior + v_delta_aprovado;

  IF NEW.aprovado_atual > v.escopo_atribuido OR NEW.executado_atual > v.escopo_atribuido
    OR NEW.aprovado_atual > NEW.executado_atual THEN
    RAISE EXCEPTION 'Avanço aprovado excede o escopo ou a execução' USING ERRCODE = 'check_violation';
  END IF;
  IF v.etapa_id IS NOT NULL
    AND NOT (SELECT permite_avanco_parcial FROM public.fvs_medicao_etapas WHERE id = v.etapa_id)
    AND NEW.aprovado_atual NOT IN (0, v.escopo_atribuido) THEN
    RAISE EXCEPTION 'Etapa binária somente libera o peso completo após aprovação' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.validate_avanco_aprovado_servico() FROM PUBLIC, anon, authenticated;
