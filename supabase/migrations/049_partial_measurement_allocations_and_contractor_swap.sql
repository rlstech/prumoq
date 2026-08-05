-- Approved releases may be consumed in more than one period. Track the exact
-- portion allocated by each measurement instead of treating a release as an
-- indivisible checkbox.
ALTER TABLE public.medicao_item_liberacoes
  ADD COLUMN IF NOT EXISTS quantidade_utilizada numeric(18,6);

UPDATE public.medicao_item_liberacoes l
SET quantidade_utilizada = aa.aprovado_atual - aa.aprovado_anterior
FROM public.avancos_aprovados_servico aa
WHERE aa.id = l.avanco_id
  AND l.quantidade_utilizada IS NULL;

ALTER TABLE public.medicao_item_liberacoes
  ALTER COLUMN quantidade_utilizada SET NOT NULL,
  ADD CONSTRAINT medicao_liberacao_quantidade_positiva
    CHECK (quantidade_utilizada > 0);

DROP INDEX IF EXISTS public.medicao_liberacao_ativa_unica;

CREATE OR REPLACE FUNCTION public.validar_alocacao_liberacao_medicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_avanco public.avancos_aprovados_servico%ROWTYPE;
  v_item public.medicao_servico_itens%ROWTYPE;
  v_alocado numeric;
  v_limite numeric;
BEGIN
  SELECT * INTO v_avanco
  FROM public.avancos_aprovados_servico
  WHERE id = NEW.avanco_id
  FOR UPDATE;

  SELECT * INTO v_item
  FROM public.medicao_servico_itens
  WHERE id = NEW.medicao_item_id;

  IF NOT FOUND OR v_avanco.vinculacao_id <> v_item.vinculacao_id THEN
    RAISE EXCEPTION 'A liberação não pertence ao vínculo medido'
      USING ERRCODE = 'check_violation';
  END IF;

  v_limite := v_avanco.aprovado_atual - v_avanco.aprovado_anterior;
  SELECT COALESCE(sum(l.quantidade_utilizada), 0)
  INTO v_alocado
  FROM public.medicao_item_liberacoes l
  JOIN public.medicao_servico_itens i ON i.id = l.medicao_item_id
  JOIN public.medicoes_servico m ON m.id = i.medicao_id
  WHERE l.avanco_id = NEW.avanco_id
    AND l.ativa
    AND m.status IN ('rascunho', 'aprovada')
    AND l.id <> NEW.id;

  IF NEW.quantidade_utilizada <= 0
    OR v_alocado + NEW.quantidade_utilizada > v_limite THEN
    RAISE EXCEPTION 'A quantidade alocada excede o saldo desta liberação'
      USING ERRCODE = 'serialization_failure';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_validar_alocacao_liberacao_medicao
  ON public.medicao_item_liberacoes;
CREATE TRIGGER trg_validar_alocacao_liberacao_medicao
BEFORE INSERT OR UPDATE OF avanco_id, medicao_item_id, quantidade_utilizada, ativa
ON public.medicao_item_liberacoes
FOR EACH ROW EXECUTE FUNCTION public.validar_alocacao_liberacao_medicao();

CREATE OR REPLACE FUNCTION public.salvar_medicao_rascunho(
  p_medicao_id uuid, p_obra_id uuid, p_equipe_id uuid, p_referencia text,
  p_periodo_inicio date, p_periodo_fim date, p_data_medicao date,
  p_observacao text, p_itens jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := COALESCE(p_medicao_id, public.uuid_generate_v4());
  v_cliente_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_release text;
  v_allocation jsonb;
  v_link public.vinculos_execucao_servico%ROWTYPE;
  v_sum numeric;
  v_price numeric;
  v_requested numeric;
BEGIN
  IF NOT public.measurement_actor_can_manage(p_obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para salvar medição' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT cliente_id INTO v_cliente_id FROM public.obras
  WHERE id=p_obra_id AND controle_medicoes_efetivo;
  IF v_cliente_id IS NULL OR p_periodo_fim<p_periodo_inicio OR NULLIF(trim(p_referencia),'') IS NULL THEN
    RAISE EXCEPTION 'Dados do boletim inválidos' USING ERRCODE='check_violation';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.obra_equipes WHERE obra_id=p_obra_id AND equipe_id=p_equipe_id AND ativo) THEN
    RAISE EXCEPTION 'Equipe não vinculada à obra' USING ERRCODE='check_violation';
  END IF;

  IF p_medicao_id IS NOT NULL THEN
    PERFORM 1 FROM public.medicoes_servico
    WHERE id=v_id AND status='rascunho' AND obra_id=p_obra_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Somente rascunhos podem ser editados' USING ERRCODE='check_violation'; END IF;
    DELETE FROM public.medicao_item_liberacoes
      WHERE medicao_item_id IN(SELECT id FROM public.medicao_servico_itens WHERE medicao_id=v_id);
    DELETE FROM public.medicao_servico_itens WHERE medicao_id=v_id;
    UPDATE public.medicoes_servico SET equipe_id=p_equipe_id,referencia=trim(p_referencia),
      periodo_inicio=p_periodo_inicio,periodo_fim=p_periodo_fim,
      data_medicao=COALESCE(p_data_medicao,current_date),observacao=p_observacao,updated_at=now()
    WHERE id=v_id;
  ELSE
    INSERT INTO public.medicoes_servico(id,cliente_id,obra_id,equipe_id,referencia,
      periodo_inicio,periodo_fim,data_medicao,observacao,criado_por)
    VALUES(v_id,v_cliente_id,p_obra_id,p_equipe_id,trim(p_referencia),p_periodo_inicio,
      p_periodo_fim,COALESCE(p_data_medicao,current_date),p_observacao,auth.uid());
  END IF;

  IF jsonb_typeof(p_itens)<>'array' OR jsonb_array_length(p_itens)=0 THEN
    RAISE EXCEPTION 'Inclua ao menos um item' USING ERRCODE='check_violation';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    SELECT * INTO v_link FROM public.vinculos_execucao_servico
    WHERE id=(v_item->>'vinculacao_id')::uuid FOR UPDATE;
    IF NOT FOUND OR public.fvs_medicao_obra(v_link.fvs_planejada_id)<>p_obra_id OR v_link.equipe_id<>p_equipe_id THEN
      RAISE EXCEPTION 'Vínculo fora do boletim' USING ERRCODE='check_violation';
    END IF;
    v_item_id:=COALESCE((v_item->>'id')::uuid,public.uuid_generate_v4());
    SELECT preco_unitario INTO v_price FROM public.fvs_medicao_configuracoes
      WHERE fvs_planejada_id=v_link.fvs_planejada_id;
    v_requested:=COALESCE((v_item->>'quantidade_periodo')::numeric,0);

    IF COALESCE(v_item->>'tipo','avanco')='avanco' THEN
      IF v_requested<=0 THEN RAISE EXCEPTION 'A quantidade medida deve ser positiva' USING ERRCODE='check_violation'; END IF;
      IF jsonb_typeof(v_item->'liberacoes')='array' THEN
        SELECT COALESCE(sum((a->>'quantidade')::numeric),0) INTO v_sum
        FROM jsonb_array_elements(v_item->'liberacoes') a;
      ELSE
        SELECT COALESCE(sum(a.aprovado_atual-a.aprovado_anterior),0) INTO v_sum
        FROM public.avancos_aprovados_servico a
        WHERE a.id IN(SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'liberacao_ids','[]'::jsonb)))
          AND a.vinculacao_id=v_link.id;
      END IF;
      IF v_sum<>v_requested THEN
        RAISE EXCEPTION 'A soma das liberações deve ser igual à quantidade do período' USING ERRCODE='check_violation';
      END IF;
    ELSE
      v_sum:=v_requested;
    END IF;

    INSERT INTO public.medicao_servico_itens(id,cliente_id,medicao_id,vinculacao_id,
      etapa_id,verificacao_id,nc_id,tipo,quantidade_anterior,quantidade_atual,
      quantidade_periodo,quantidade_bloqueada,unidade,preco_unitario,valor_calculado)
    VALUES(v_item_id,v_cliente_id,v_id,v_link.id,v_link.etapa_id,
      NULLIF(v_item->>'verificacao_id','')::uuid,NULLIF(v_item->>'nc_id','')::uuid,
      COALESCE(v_item->>'tipo','avanco')::public.tipo_item_medicao,
      COALESCE((v_item->>'quantidade_anterior')::numeric,0),
      COALESCE((v_item->>'quantidade_atual')::numeric,v_sum),v_sum,
      COALESCE((v_item->>'quantidade_bloqueada')::numeric,0),
      COALESCE(v_item->>'unidade','un'),COALESCE((v_item->>'preco_unitario')::numeric,v_price),
      COALESCE((v_item->>'valor_calculado')::numeric,v_sum*COALESCE(v_price,0)));

    IF COALESCE(v_item->>'tipo','avanco')='avanco' THEN
      IF jsonb_typeof(v_item->'liberacoes')='array' THEN
        FOR v_allocation IN SELECT value FROM jsonb_array_elements(v_item->'liberacoes') LOOP
          INSERT INTO public.medicao_item_liberacoes(cliente_id,medicao_item_id,avanco_id,quantidade_utilizada)
          VALUES(v_cliente_id,v_item_id,(v_allocation->>'avanco_id')::uuid,(v_allocation->>'quantidade')::numeric);
        END LOOP;
      ELSE
        FOR v_release IN SELECT value FROM jsonb_array_elements_text(v_item->'liberacao_ids') LOOP
          INSERT INTO public.medicao_item_liberacoes(cliente_id,medicao_item_id,avanco_id,quantidade_utilizada)
          SELECT v_cliente_id,v_item_id,a.id,a.aprovado_atual-a.aprovado_anterior
          FROM public.avancos_aprovados_servico a WHERE a.id=v_release::uuid;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION public.aprovar_medicao_servico(p_medicao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE m public.medicoes_servico%ROWTYPE; item record; saldo record; actor uuid:=auth.uid();
BEGIN
  SELECT * INTO m FROM public.medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(m.obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar medição' USING ERRCODE='insufficient_privilege';
  END IF;
  IF m.status<>'rascunho' THEN RAISE EXCEPTION 'Somente medições em rascunho podem ser aprovadas' USING ERRCODE='check_violation'; END IF;
  IF NOT (SELECT controle_medicoes_efetivo FROM public.obras WHERE id=m.obra_id) THEN
    RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE='check_violation';
  END IF;
  FOR item IN SELECT i.* FROM public.medicao_servico_itens i WHERE i.medicao_id=m.id ORDER BY i.vinculacao_id FOR UPDATE LOOP
    PERFORM 1 FROM public.vinculos_execucao_servico WHERE id=item.vinculacao_id FOR UPDATE;
    IF item.tipo='avanco' THEN
      SELECT * INTO saldo FROM public.saldo_vinculo_execucao(item.vinculacao_id);
      IF item.quantidade_periodo>saldo.disponivel THEN
        RAISE EXCEPTION 'Quantidade medida excede saldo aprovado disponível' USING ERRCODE='serialization_failure';
      END IF;
      IF item.quantidade_periodo<>(SELECT COALESCE(sum(l.quantidade_utilizada),0)
        FROM public.medicao_item_liberacoes l WHERE l.medicao_item_id=item.id AND l.ativa) THEN
        RAISE EXCEPTION 'As alocações não correspondem à quantidade medida' USING ERRCODE='check_violation';
      END IF;
    END IF;
  END LOOP;
  UPDATE public.medicoes_servico SET status='aprovada',aprovado_por=actor,
    aprovado_em=now(),updated_at=now() WHERE id=m.id;
  INSERT INTO public.auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,usuario_id)
  VALUES(m.cliente_id,m.obra_id,'medicao',m.id,'aprovada',actor);
END
$$;

CREATE OR REPLACE FUNCTION public.trocar_empreiteiro_servico(
  p_vinculo_id uuid, p_nova_equipe_id uuid, p_data date, p_motivo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.vinculos_execucao_servico%ROWTYPE;
  v_novo uuid;
  v_executado numeric;
  v_aprovado numeric;
  v_medido numeric;
  v_restante numeric;
  v_obra uuid;
  v_actor uuid:=auth.uid();
BEGIN
  SELECT * INTO v FROM public.vinculos_execucao_servico WHERE id=p_vinculo_id FOR UPDATE;
  v_obra:=public.fvs_medicao_obra(v.fvs_planejada_id);
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(v_obra) OR p_data IS NULL
    OR NULLIF(trim(p_motivo),'') IS NULL THEN
    RAISE EXCEPTION 'Troca de empreiteiro inválida' USING ERRCODE='check_violation';
  END IF;
  IF v.status<>'ativo' OR p_data<v.data_inicio OR p_nova_equipe_id=v.equipe_id
    OR NOT EXISTS(SELECT 1 FROM public.obra_equipes WHERE obra_id=v_obra AND equipe_id=p_nova_equipe_id AND ativo) THEN
    RAISE EXCEPTION 'Nova equipe, data ou vínculo inválidos para a troca' USING ERRCODE='check_violation';
  END IF;
  SELECT COALESCE(max(executado_atual),0),COALESCE(max(aprovado_atual),0)
    INTO v_executado,v_aprovado FROM public.avancos_aprovados_servico WHERE vinculacao_id=v.id;
  SELECT s.medido INTO v_medido FROM public.saldo_vinculo_execucao(v.id) s;
  v_restante:=v.escopo_atribuido-v_executado;
  IF v_restante<=0 THEN RAISE EXCEPTION 'Não existe escopo não executado para transferir' USING ERRCODE='check_violation'; END IF;

  UPDATE public.vinculos_execucao_servico SET status='substituido',data_termino=p_data,
    motivo_encerramento=trim(p_motivo),aprovado_congelado=v_aprovado,
    medido_congelado=v_medido,encerrado_por=v_actor,updated_at=now() WHERE id=v.id;
  INSERT INTO public.vinculos_execucao_servico(cliente_id,fvs_planejada_id,etapa_id,
    equipe_id,data_inicio,escopo_atribuido,criado_por)
  VALUES(v.cliente_id,v.fvs_planejada_id,v.etapa_id,p_nova_equipe_id,p_data,v_restante,v_actor)
  RETURNING id INTO v_novo;
  INSERT INTO public.auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,dados,usuario_id)
  VALUES(v.cliente_id,v_obra,'vinculo_execucao',v_novo,'empreiteiro_trocado',
    jsonb_build_object('vinculo_anterior',v.id,'equipe_anterior',v.equipe_id,
      'nova_equipe',p_nova_equipe_id,'executado_congelado',v_executado,
      'aprovado_congelado',v_aprovado,'medido_congelado',v_medido,
      'saldo_aprovado_anterior',greatest(v_aprovado-v_medido,0),
      'escopo_transferido',v_restante,'motivo',trim(p_motivo)),v_actor);
  RETURN v_novo;
END
$$;

REVOKE ALL ON FUNCTION public.validar_alocacao_liberacao_medicao() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_medicao_rascunho(uuid,uuid,uuid,text,date,date,date,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aprovar_medicao_servico(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trocar_empreiteiro_servico(uuid,uuid,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_medicao_rascunho(uuid,uuid,uuid,text,date,date,date,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_medicao_servico(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trocar_empreiteiro_servico(uuid,uuid,date,text) TO authenticated;
