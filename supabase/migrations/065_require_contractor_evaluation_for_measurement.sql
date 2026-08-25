-- Ativada após a distribuição do app com avaliações offline.
CREATE OR REPLACE FUNCTION public.aprovar_medicao_servico(p_medicao_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.medicoes_servico%ROWTYPE; item record; saldo record; actor uuid:=auth.uid(); v_terceirizado boolean;
BEGIN
  SELECT * INTO m FROM public.medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(m.obra_id) THEN RAISE EXCEPTION 'Sem permissão para aprovar medição' USING ERRCODE='insufficient_privilege'; END IF;
  IF m.status<>'rascunho' THEN RAISE EXCEPTION 'Somente medições em rascunho podem ser aprovadas' USING ERRCODE='check_violation'; END IF;
  IF NOT (SELECT controle_medicoes_efetivo FROM public.obras WHERE id=m.obra_id) THEN RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE='check_violation'; END IF;
  SELECT tipo='terceirizado' INTO v_terceirizado FROM public.equipes WHERE id=m.equipe_id;
  IF coalesce(v_terceirizado,false) AND NOT EXISTS(
    SELECT 1 FROM public.avaliacoes_empreiteiro a
    WHERE a.medicao_id=m.id AND a.status='concluida' AND a.obra_id=m.obra_id AND a.equipe_id=m.equipe_id
  ) THEN RAISE EXCEPTION 'Conclua e sincronize a avaliação do empreiteiro antes de aprovar esta medição' USING ERRCODE='check_violation'; END IF;
  FOR item IN SELECT i.* FROM public.medicao_servico_itens i WHERE i.medicao_id=m.id ORDER BY i.vinculacao_id FOR UPDATE LOOP
    PERFORM 1 FROM public.vinculos_execucao_servico WHERE id=item.vinculacao_id FOR UPDATE;
    IF item.tipo='avanco' THEN
      SELECT * INTO saldo FROM public.saldo_vinculo_execucao(item.vinculacao_id);
      IF item.quantidade_periodo>saldo.disponivel THEN RAISE EXCEPTION 'Quantidade medida excede saldo aprovado disponível' USING ERRCODE='serialization_failure'; END IF;
      IF item.quantidade_periodo<>(SELECT coalesce(sum(l.quantidade_utilizada),0) FROM public.medicao_item_liberacoes l WHERE l.medicao_item_id=item.id AND l.ativa) THEN RAISE EXCEPTION 'As alocações não correspondem à quantidade medida' USING ERRCODE='check_violation'; END IF;
    END IF;
  END LOOP;
  UPDATE public.medicoes_servico SET status='aprovada',aprovado_por=actor,aprovado_em=now(),updated_at=now() WHERE id=m.id;
  INSERT INTO public.auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,usuario_id) VALUES(m.cliente_id,m.obra_id,'medicao',m.id,'aprovada',actor);
END $$;
REVOKE ALL ON FUNCTION public.aprovar_medicao_servico(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.aprovar_medicao_servico(uuid) TO authenticated;

-- A avaliação concluída é o retrato da medição: o rascunho não pode mais ser
-- editado ou descartado sem antes invalidar a avaliação (e registrar o motivo).
CREATE OR REPLACE FUNCTION public.bloquear_edicao_medicao_avaliada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  IF TG_OP='UPDATE' AND NEW.status <> 'rascunho' THEN
    RETURN NEW; -- aprovação/cancelamento seguem seu fluxo controlado.
  END IF;
  IF EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a WHERE a.medicao_id=v_id AND a.status='concluida') THEN
    RAISE EXCEPTION 'A medição possui avaliação concluída; invalide-a antes de alterar a medição' USING ERRCODE='check_violation';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_bloquear_edicao_medicao_avaliada ON public.medicoes_servico;
CREATE TRIGGER trg_bloquear_edicao_medicao_avaliada
BEFORE UPDATE OR DELETE ON public.medicoes_servico
FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_medicao_avaliada();
