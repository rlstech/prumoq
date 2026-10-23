CREATE OR REPLACE FUNCTION public.salvar_modelo_etapas_medicao(p_modelo_id uuid, p_empresa_id uuid, p_nome text, p_ativo boolean, p_etapas jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_modelo_id uuid := COALESCE(p_modelo_id, uuid_generate_v4());
  v_cliente_id uuid;
  v_total numeric;
  v_item jsonb;
BEGIN
  IF auth.uid() IS NULL OR get_perfil() <> 'admin' THEN
    RAISE EXCEPTION 'Somente administradores podem editar modelos de medição' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT cliente_id INTO v_cliente_id FROM empresas WHERE id=p_empresa_id AND has_cliente_access(cliente_id);
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Empresa fora do escopo' USING ERRCODE='insufficient_privilege'; END IF;
  IF NULLIF(trim(p_nome),'') IS NULL OR jsonb_typeof(p_etapas) <> 'array' THEN
    RAISE EXCEPTION 'Nome e etapas são obrigatórios' USING ERRCODE='check_violation';
  END IF;
  SELECT COALESCE(sum((e->>'peso_percentual')::numeric) FILTER (WHERE COALESCE((e->>'ativo')::boolean,true)),0)
    INTO v_total FROM jsonb_array_elements(p_etapas) e;
  IF v_total <> 100.0000 THEN RAISE EXCEPTION 'Os pesos ativos do modelo devem somar exatamente 100%%' USING ERRCODE='check_violation'; END IF;

  INSERT INTO modelos_etapas_medicao(id,cliente_id,empresa_id,nome,ativo,criado_por)
  VALUES(v_modelo_id,v_cliente_id,p_empresa_id,trim(p_nome),p_ativo,auth.uid())
  ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome,ativo=EXCLUDED.ativo,updated_at=now()
  WHERE modelos_etapas_medicao.cliente_id=v_cliente_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado' USING ERRCODE='no_data_found'; END IF;
  DELETE FROM modelo_etapas_medicao_itens WHERE modelo_id=v_modelo_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_etapas) LOOP
    INSERT INTO modelo_etapas_medicao_itens(cliente_id,modelo_id,ordem,nome,peso_percentual,permite_avanco_parcial,ativo)
    VALUES(v_cliente_id,v_modelo_id,(v_item->>'ordem')::integer,trim(v_item->>'nome'),(v_item->>'peso_percentual')::numeric,
      COALESCE((v_item->>'permite_avanco_parcial')::boolean,false),COALESCE((v_item->>'ativo')::boolean,true));
  END LOOP;
  RETURN v_modelo_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_fvs_lifecycle_status(p_fvs_id uuid, p_status text, p_field text, p_now timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_field = 'ultima_conclusao_em' THEN
    UPDATE fvs_planejadas
    SET status = p_status::status_fvs,
        ultima_conclusao_em = p_now,
        updated_at = p_now
    WHERE id = p_fvs_id;
  ELSIF p_field = 'ultima_reabertura_em' THEN
    UPDATE fvs_planejadas
    SET status = p_status::status_fvs,
        ultima_reabertura_em = p_now,
        updated_at = p_now
    WHERE id = p_fvs_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_obra_feature_overrides(p_obra_id uuid, p_medicoes_override boolean, p_financeiro_override boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR get_perfil() NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Sem permissão para configurar os recursos da obra'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT cliente_id INTO v_cliente_id
  FROM obras
  WHERE id = p_obra_id
  FOR UPDATE;

  IF v_cliente_id IS NULL OR NOT has_obra_access(p_obra_id) THEN
    RAISE EXCEPTION 'Obra não encontrada ou fora do seu escopo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE obras
  SET controle_medicoes_override = p_medicoes_override,
      controle_financeiro_nc_override = p_financeiro_override
  WHERE id = p_obra_id AND cliente_id = v_cliente_id;

  INSERT INTO auditoria_operacional (
    cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id
  ) VALUES (
    v_cliente_id,
    p_obra_id,
    'obra',
    p_obra_id,
    'recursos_opcionais_configurados',
    jsonb_build_object(
      'controle_medicoes_override', p_medicoes_override,
      'controle_financeiro_nc_override', p_financeiro_override
    ),
    v_actor
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_obra_status_after_ambiente_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_old_obra_id uuid;
  v_new_obra_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_obra_id := OLD.obra_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_obra_id := NEW.obra_id;
  END IF;

  IF v_old_obra_id IS NOT NULL THEN
    PERFORM public.sync_obra_status_from_fvs(v_old_obra_id);
  END IF;

  IF v_new_obra_id IS NOT NULL
     AND v_new_obra_id IS DISTINCT FROM v_old_obra_id THEN
    PERFORM public.sync_obra_status_from_fvs(v_new_obra_id);
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_obra_status_after_fvs_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_old_obra_id uuid;
  v_new_obra_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT a.obra_id
    INTO v_old_obra_id
    FROM public.ambientes a
    WHERE a.id = OLD.ambiente_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT a.obra_id
    INTO v_new_obra_id
    FROM public.ambientes a
    WHERE a.id = NEW.ambiente_id;
  END IF;

  IF v_old_obra_id IS NOT NULL THEN
    PERFORM public.sync_obra_status_from_fvs(v_old_obra_id);
  END IF;

  IF v_new_obra_id IS NOT NULL
     AND v_new_obra_id IS DISTINCT FROM v_old_obra_id THEN
    PERFORM public.sync_obra_status_from_fvs(v_new_obra_id);
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_obra_status_from_fvs(p_obra_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_status         status_obra;
  v_ativo          boolean;
  v_total_fvs      bigint;
  v_fvs_concluidas bigint;
BEGIN
  IF p_obra_id IS NULL THEN
    RETURN;
  END IF;

  -- Serializa recalculos concorrentes da mesma obra. O COUNT abaixo executa
  -- em uma nova instrucao e enxerga alteracoes que terminaram enquanto o lock
  -- estava sendo aguardado.
  SELECT o.status, o.ativo
  INTO v_status, v_ativo
  FROM public.obras o
  WHERE o.id = p_obra_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_ativo OR v_status = 'paralisada' THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE fp.status IN ('conforme', 'concluida', 'concluida_ressalva')
    )
  INTO v_total_fvs, v_fvs_concluidas
  FROM public.fvs_planejadas fp
  JOIN public.ambientes a ON a.id = fp.ambiente_id
  WHERE a.obra_id = p_obra_id
    AND a.ativo = true;

  -- Sem FVS nao ha progresso suficiente para inferir o estado da obra.
  IF v_total_fvs = 0 THEN
    RETURN;
  END IF;

  IF v_fvs_concluidas = v_total_fvs AND v_status <> 'concluida' THEN
    UPDATE public.obras
    SET status = 'concluida'
    WHERE id = p_obra_id;
  ELSIF v_fvs_concluidas < v_total_fvs AND v_status = 'concluida' THEN
    UPDATE public.obras
    SET status = 'em_andamento'
    WHERE id = p_obra_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_criar_modelos_medicao_empresa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM criar_modelos_medicao_empresa(NEW.id, NEW.cliente_id, auth.uid());
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.trocar_empreiteiro_servico(p_vinculo_id uuid, p_nova_equipe_id uuid, p_data date, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    OR NOT EXISTS(SELECT 1 FROM public.obra_equipes WHERE obra_id=v_obra AND equipe_id=p_nova_equipe_id) THEN
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_fvs_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_status_atual status_fvs;
BEGIN
  SELECT status INTO v_status_atual
  FROM fvs_planejadas
  WHERE id = NEW.fvs_planejada_id;

  IF v_status_atual IN ('conforme', 'concluida', 'concluida_ressalva') THEN
    RETURN NEW;
  END IF;

  IF v_status_atual = 'em_revisao' THEN
    UPDATE fvs_planejadas
    SET updated_at = now()
    WHERE id = NEW.fvs_planejada_id;
    RETURN NEW;
  END IF;

  UPDATE fvs_planejadas
  SET
    status = 'em_andamento',
    concluida_em = NULL,
    updated_at = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_alocacao_liberacao_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validate_avanco_aprovado_servico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validate_cliente_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.limite_usuarios IS NOT NULL AND NEW.limite_usuarios < (
    SELECT count(*) FROM usuarios WHERE cliente_id = NEW.id AND ativo
  ) THEN RAISE EXCEPTION 'Limite de usuários menor que o consumo atual' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.limite_empresas IS NOT NULL AND NEW.limite_empresas < (
    SELECT count(*) FROM empresas WHERE cliente_id = NEW.id AND ativo
  ) THEN RAISE EXCEPTION 'Limite de empresas menor que o consumo atual' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.limite_obras IS NOT NULL AND NEW.limite_obras < (
    SELECT count(*) FROM obras WHERE cliente_id = NEW.id AND ativo
  ) THEN RAISE EXCEPTION 'Limite de obras menor que o consumo atual' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_fvs_conclusao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_status_atual status_fvs;
BEGIN
  -- O PowerSync pode reenviar um PUT já confirmado. O upsert precisa alcançar
  -- o ON CONFLICT sem ser bloqueado pela FVS que a própria linha concluiu.
  IF EXISTS (
    SELECT 1
    FROM fvs_conclusoes fc
    WHERE fc.id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT status
  INTO v_status_atual
  FROM fvs_planejadas
  WHERE id = NEW.fvs_planejada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FVS não encontrada';
  END IF;

  IF v_status_atual IN ('conforme', 'concluida', 'concluida_ressalva') THEN
    RAISE EXCEPTION 'A FVS já está concluída';
  END IF;

  IF NEW.verificacao_id IS NULL THEN
    RAISE EXCEPTION 'A conclusão deve referenciar uma verificação';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM verificacoes v
    WHERE v.id = NEW.verificacao_id
      AND v.fvs_planejada_id = NEW.fvs_planejada_id
      AND v.status = 'conforme'
  ) THEN
    RAISE EXCEPTION 'A conclusão deve referenciar uma verificação conforme da mesma FVS';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM verificacao_itens vi
    WHERE vi.verificacao_id = NEW.verificacao_id
  ) OR EXISTS (
    SELECT 1
    FROM verificacao_itens vi
    WHERE vi.verificacao_id = NEW.verificacao_id
      AND vi.resultado = 'nao_conforme'
  ) THEN
    RAISE EXCEPTION 'Todos os itens da verificação devem estar conforme ou não aplicáveis';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM nc_reinspecoes nr
    WHERE nr.verificacao_id = NEW.verificacao_id
  ) THEN
    RAISE EXCEPTION 'Uma reinspeção não pode concluir a FVS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM nao_conformidades nc
    JOIN verificacoes v ON v.id = nc.verificacao_id
    WHERE v.fvs_planejada_id = NEW.fvs_planejada_id
      AND nc.status IN ('aberta', 'em_correcao')
  ) THEN
    RAISE EXCEPTION 'Não é possível concluir uma FVS com NC não resolvida';
  END IF;

  NEW.numero_conclusao := (
    SELECT COUNT(*)::integer + 1
    FROM fvs_conclusoes fc
    WHERE fc.fvs_planejada_id = NEW.fvs_planejada_id
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_medicao_feature_enabled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_obra_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'fvs_medicao_configuracoes' THEN
    v_obra_id := fvs_medicao_obra(NEW.fvs_planejada_id);
  ELSIF TG_TABLE_NAME = 'vinculos_execucao_servico' THEN
    v_obra_id := fvs_medicao_obra(NEW.fvs_planejada_id);
  ELSIF TG_TABLE_NAME = 'medicoes_servico' THEN
    v_obra_id := NEW.obra_id;
  ELSIF TG_TABLE_NAME = 'medicao_servico_itens' THEN
    SELECT obra_id INTO v_obra_id FROM medicoes_servico WHERE id = NEW.medicao_id;
  END IF;

  IF v_obra_id IS NULL OR NOT COALESCE((SELECT controle_medicoes_efetivo FROM obras WHERE id = v_obra_id), false) THEN
    RAISE EXCEPTION 'Controle de medições desabilitado nesta obra'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_medicao_item_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_obra_id uuid;
  v_fvs_id uuid;
  v_equipe_id uuid;
  v_etapa_id uuid;
BEGIN
  SELECT obra_id, equipe_id INTO v_obra_id, v_equipe_id
  FROM medicoes_servico WHERE id = NEW.medicao_id;
  SELECT fvs_planejada_id, equipe_id, etapa_id INTO v_fvs_id, v_equipe_id, v_etapa_id
  FROM vinculos_execucao_servico WHERE id = NEW.vinculacao_id;

  IF v_obra_id IS NULL
    OR v_equipe_id IS DISTINCT FROM (SELECT equipe_id FROM medicoes_servico WHERE id = NEW.medicao_id)
    OR fvs_medicao_obra(v_fvs_id) IS DISTINCT FROM v_obra_id
    OR NEW.etapa_id IS DISTINCT FROM v_etapa_id THEN
    RAISE EXCEPTION 'Item de medição não pertence à obra, equipe ou etapa informada'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.verificacao_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM verificacoes WHERE id = NEW.verificacao_id AND fvs_planejada_id = v_fvs_id
  ) THEN
    RAISE EXCEPTION 'Verificação não pertence ao serviço medido' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.nc_id IS NOT NULL AND nc_obra(NEW.nc_id) IS DISTINCT FROM v_obra_id THEN
    RAISE EXCEPTION 'NC não pertence à obra medida' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_nc_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_obra uuid;
  v_enabled boolean;
BEGIN
  v_obra := public.fvs_medicao_obra((SELECT fvs_planejada_id FROM public.verificacoes WHERE id=NEW.verificacao_id));
  SELECT controle_financeiro_nc_efetivo INTO v_enabled FROM public.obras WHERE id=v_obra;
  IF TG_OP='INSERT' AND v_enabled THEN NEW.financeiro_requerido:=true; END IF;

  IF NEW.financeiro_requerido AND v_enabled THEN
    IF NEW.situacao_financeira IS NULL OR NEW.bloqueio_medicao IS NULL THEN
      RAISE EXCEPTION 'Declare a situação financeira e o bloqueio de medição da NC' USING ERRCODE='check_violation';
    END IF;
    IF NEW.situacao_financeira='sem_impacto'
      AND (NULLIF(trim(COALESCE(NEW.justificativa_sem_impacto,'')),'') IS NULL OR COALESCE(NEW.valor_confirmado,0)<>0) THEN
      RAISE EXCEPTION 'Sem impacto exige justificativa e valor confirmado zero' USING ERRCODE='check_violation';
    ELSIF NEW.situacao_financeira='em_avaliacao'
      AND (NEW.responsavel_avaliacao_id IS NULL OR NEW.prazo_avaliacao IS NULL) THEN
      RAISE EXCEPTION 'Impacto em avaliação exige responsável e prazo' USING ERRCODE='check_violation';
    ELSIF NEW.situacao_financeira='estimado'
      AND (COALESCE(NEW.valor_estimado,0)<=0 OR NEW.responsavel_financeiro IS NULL OR NEW.categoria_financeira IS NULL) THEN
      RAISE EXCEPTION 'Impacto estimado exige valor, responsável e categoria' USING ERRCODE='check_violation';
    ELSIF NEW.situacao_financeira='confirmado'
      AND (COALESCE(NEW.valor_confirmado,0)<=0 OR NEW.responsavel_financeiro IS NULL OR NEW.categoria_financeira IS NULL) THEN
      RAISE EXCEPTION 'Impacto confirmado exige valor, responsável e categoria' USING ERRCODE='check_violation';
    END IF;
    IF NEW.bloqueio_medicao='parcial'
      AND COALESCE(NEW.valor_bloqueado,0)<=0
      AND COALESCE(NEW.quantidade_bloqueada,0)<=0
      AND COALESCE(NEW.percentual_bloqueado,0)<=0 THEN
      RAISE EXCEPTION 'Bloqueio parcial exige valor bloqueado (ou quantidade/percentual legados)' USING ERRCODE='check_violation';
    END IF;
  END IF;

  IF NEW.status IN ('resolvida','encerrada_sem_resolucao')
    AND NEW.financeiro_requerido AND v_enabled
    AND NEW.situacao_financeira NOT IN ('sem_impacto','confirmado') THEN
    RAISE EXCEPTION 'NC em avaliação ou estimada não pode ser encerrada' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.validate_resource_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  obra_empresa uuid;
  recurso_escopo escopo_cadastro;
BEGIN
  IF TG_TABLE_NAME = 'obra_equipes' THEN
    SELECT empresa_id INTO obra_empresa FROM obras WHERE id = NEW.obra_id;
    SELECT escopo INTO recurso_escopo FROM equipes WHERE id = NEW.equipe_id;
    IF recurso_escopo = 'restrito' AND NOT EXISTS (
      SELECT 1 FROM equipe_empresas ee
      WHERE ee.equipe_id = NEW.equipe_id AND ee.empresa_id = obra_empresa
    ) THEN
      RAISE EXCEPTION 'Equipe não disponível para a empresa desta obra' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    SELECT o.empresa_id INTO obra_empresa
    FROM ambientes a JOIN obras o ON o.id = a.obra_id
    WHERE a.id = NEW.ambiente_id;
    SELECT escopo INTO recurso_escopo FROM fvs_padrao WHERE id = NEW.fvs_padrao_id;
    IF recurso_escopo = 'restrito' AND NOT EXISTS (
      SELECT 1 FROM fvs_padrao_empresas fe
      WHERE fe.fvs_padrao_id = NEW.fvs_padrao_id AND fe.empresa_id = obra_empresa
    ) THEN
      RAISE EXCEPTION 'FVS não disponível para a empresa desta obra' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_stage_weights()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE config_id uuid := COALESCE(NEW.configuracao_id, OLD.configuracao_id); total numeric;
BEGIN
  SELECT COALESCE(sum(peso_percentual) FILTER (WHERE ativo), 0) INTO total FROM fvs_medicao_etapas WHERE configuracao_id = config_id;
  IF EXISTS (SELECT 1 FROM fvs_medicao_configuracoes WHERE id = config_id AND metodo = 'etapas_ponderadas') AND total <> 100.0000 THEN
    RAISE EXCEPTION 'Os pesos ativos das etapas devem somar exatamente 100%%' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $function$
;

CREATE OR REPLACE FUNCTION public.validate_tenant_media_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_field text;
  v_value text;
  v_old_value text;
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  FOREACH v_field IN ARRAY ARRAY[
    'r2_key', 'r2_thumb_key', 'assinatura_url', 'assinatura_padrao_url',
    'foto_url', 'foto_reinspecao_url', 'documento_financeiro_r2_key'
  ] LOOP
    v_value := v_new ->> v_field;
    v_old_value := v_old ->> v_field;
    IF v_value IS NULL OR (TG_OP = 'UPDATE' AND v_value IS NOT DISTINCT FROM v_old_value) THEN CONTINUE; END IF;
    IF NOT public.is_tenant_media_key(v_value, NEW.cliente_id) THEN
      RAISE EXCEPTION 'Referência de mídia inválida para o cliente' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$
;
