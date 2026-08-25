-- Fix: protect_medicao_history falha com 42703 em medicao_servico_itens.
--
-- A versão introduzida na migration 046 resolveu o campo do registro dentro da
-- subquery SQL:
--
--   WHERE i.id = CASE WHEN TG_TABLE_NAME='medicao_servico_itens'
--                 THEN COALESCE(NEW.id,OLD.id)
--                 ELSE COALESCE(NEW.medicao_item_id,OLD.medicao_item_id) END
--
-- Como o CASE é enviado ao planner SQL com o record NEW já tipado, TODOS os
-- campos do CASE são resolvidos em tempo de análise — e medicao_servico_itens
-- não possui coluna medicao_item_id. Resultado: qualquer DELETE/UPDATE em
-- medicao_servico_itens (edição de rascunho, descarte) falha com
-- "42703: record \"new\" has no field \"medicao_item_id\"".
--
-- A correção resolve o campo em plpgsql (fora da subquery), onde o CASE é
-- avaliado em runtime e somente o ramo certo toca o record.

CREATE OR REPLACE FUNCTION public.protect_medicao_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_allowed boolean := current_setting('app.measurement_controlled_write', true) = '1';
  v_item_id uuid;
BEGIN
  IF v_allowed THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME='medicoes_servico' THEN
    IF TG_OP='DELETE' OR (OLD.status='aprovada' AND NEW.status<>'cancelada') OR OLD.status='cancelada' THEN
      RAISE EXCEPTION 'Medições aprovadas ou canceladas não podem ser alteradas diretamente' USING ERRCODE='check_violation';
    END IF;
  ELSIF TG_TABLE_NAME IN ('medicao_servico_itens','medicao_item_liberacoes') THEN
    IF TG_TABLE_NAME='medicao_servico_itens' THEN
      v_item_id := COALESCE(NEW.id, OLD.id);
    ELSE
      v_item_id := COALESCE(NEW.medicao_item_id, OLD.medicao_item_id);
    END IF;
    IF EXISTS(
      SELECT 1 FROM public.medicoes_servico h
      JOIN public.medicao_servico_itens i ON i.medicao_id=h.id
      WHERE i.id=v_item_id AND h.status<>'rascunho'
    ) THEN
      RAISE EXCEPTION 'Itens de medição aprovada ou cancelada são imutáveis' USING ERRCODE='check_violation';
    END IF;
  END IF;

  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

-- Descartar_medicao_rascunho nunca definiu app.measurement_controlled_write e,
-- desde a criação em 046, qualquer DELETE em medicoes_servico era bloqueado pela
-- própria trigger (TG_OP='DELETE' → RAISE). O descarte de rascunho fica
-- autorizado seguindo o mesmo padrão já usado em cancelar_medicao_servico.
CREATE OR REPLACE FUNCTION public.descartar_medicao_rascunho(p_medicao_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.medicoes_servico%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR v.status<>'rascunho' OR NOT public.measurement_actor_can_manage(v.obra_id) THEN
    RAISE EXCEPTION 'Rascunho não pode ser descartado' USING ERRCODE='check_violation';
  END IF;
  PERFORM set_config('app.measurement_controlled_write','1',true);
  DELETE FROM public.medicao_item_liberacoes WHERE medicao_item_id IN(SELECT id FROM public.medicao_servico_itens WHERE medicao_id=v.id);
  DELETE FROM public.medicao_servico_itens WHERE medicao_id=v.id;
  DELETE FROM public.medicoes_servico WHERE id=v.id;
END
$$;

REVOKE ALL ON FUNCTION public.protect_medicao_history() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.descartar_medicao_rascunho(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.descartar_medicao_rascunho(uuid) TO authenticated;
