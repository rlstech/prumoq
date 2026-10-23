CREATE OR REPLACE FUNCTION public.apply_fvs_conclusao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE fvs_planejadas
  SET
    status = 'concluida',
    percentual_exec = 100,
    concluida_em = NEW.created_at,
    ultima_conclusao_em = NEW.created_at,
    total_conclusoes = (
      SELECT COUNT(*)::integer
      FROM fvs_conclusoes fc
      WHERE fc.fvs_planejada_id = NEW.fvs_planejada_id
    ),
    updated_at = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_fvs_reabertura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE fvs_planejadas
  SET
    status = 'em_revisao',
    concluida_em = NULL,
    ultima_reabertura_em = NEW.created_at,
    total_reaberturas = (
      SELECT COUNT(*)::integer
      FROM fvs_reaberturas fr
      WHERE fr.fvs_planejada_id = NEW.fvs_planejada_id
    ),
    updated_at = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_nc_reinspecao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_origem_fvs uuid; v_reinspecao_fvs uuid;
BEGIN
  SELECT v.fvs_planejada_id INTO v_origem_fvs FROM public.nao_conformidades nc JOIN public.verificacoes v ON v.id=nc.verificacao_id WHERE nc.id=NEW.nc_id FOR UPDATE;
  SELECT v.fvs_planejada_id INTO v_reinspecao_fvs FROM public.verificacoes v WHERE v.id=NEW.verificacao_id AND v.inspetor_id=NEW.inspetor_id;
  IF v_origem_fvs IS NULL OR v_reinspecao_fvs IS NULL OR v_origem_fvs<>v_reinspecao_fvs OR NEW.inspetor_id<>auth.uid() THEN RAISE EXCEPTION 'Reinspecao fora do escopo autorizado' USING ERRCODE='insufficient_privilege'; END IF;
  IF NEW.resultado='aprovada' THEN UPDATE public.nao_conformidades SET status='resolvida',resolvida_em=NEW.created_at,verificacao_reinsp_id=NEW.verificacao_id,resolvida_na_verif_id=NEW.verificacao_id,foto_reinspecao_url=NEW.foto_url,updated_at=now() WHERE id=NEW.nc_id;
  ELSIF NEW.resultado='reprovada' THEN UPDATE public.nao_conformidades SET status='encerrada_sem_resolucao',updated_at=now() WHERE id=NEW.nc_id;
  ELSE RAISE EXCEPTION 'Resultado de reinspecao invalido' USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.aprovar_avaliacao_empreiteiro(p_avaliacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.avaliacoes_empreiteiro%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.avaliacoes_empreiteiro WHERE id=p_avaliacao_id FOR UPDATE;
  IF NOT FOUND OR public.get_perfil() NOT IN ('admin','gestor') OR NOT public.has_obra_access(a.obra_id)
    OR a.status<>'concluida' THEN
    RAISE EXCEPTION 'Aprovação não permitida' USING ERRCODE='check_violation';
  END IF;
  UPDATE public.avaliacoes_empreiteiro
  SET status='aprovada', aprovada_por=auth.uid(), aprovada_em=now(), updated_at=now()
  WHERE id=a.id;
END $function$
;

CREATE OR REPLACE FUNCTION public.aprovar_medicao_servico(p_medicao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE m public.medicoes_servico%ROWTYPE; item record; saldo record; actor uuid:=auth.uid(); v_terceirizado boolean;
BEGIN
  SELECT * INTO m FROM public.medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(m.obra_id) THEN RAISE EXCEPTION 'Sem permissão para aprovar medição' USING ERRCODE='insufficient_privilege'; END IF;
  IF m.status<>'rascunho' THEN RAISE EXCEPTION 'Somente medições em rascunho podem ser aprovadas' USING ERRCODE='check_violation'; END IF;
  IF NOT (SELECT controle_medicoes_efetivo FROM public.obras WHERE id=m.obra_id) THEN RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE='check_violation'; END IF;
  SELECT tipo='terceirizado' INTO v_terceirizado FROM public.equipes WHERE id=m.equipe_id;
  IF coalesce(v_terceirizado,false) AND NOT EXISTS(
    SELECT 1 FROM public.avaliacoes_empreiteiro a
    WHERE a.medicao_id=m.id AND a.status='aprovada' AND a.obra_id=m.obra_id AND a.equipe_id=m.equipe_id
  ) THEN RAISE EXCEPTION 'Aprovar a avaliação do empreiteiro antes de aprovar esta medição' USING ERRCODE='check_violation'; END IF;
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
END $function$
;

CREATE OR REPLACE FUNCTION public.atualizar_etapa_medicao_ao_aprovar_avanco()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_impacto_financeiro_nc(p_nc_id uuid, p_situacao situacao_impacto_financeiro_nc, p_bloqueio bloqueio_medicao_nc, p_justificativa text, p_responsavel_avaliacao uuid, p_prazo date, p_valor_estimado numeric, p_valor_confirmado numeric, p_responsavel_financeiro responsavel_financeiro_nc, p_categoria categoria_impacto_financeiro_nc, p_valor_bloqueado numeric, p_observacao text, p_documento text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n nao_conformidades%ROWTYPE;
  v_obra uuid;
BEGIN
  SELECT * INTO n FROM nao_conformidades WHERE id=p_nc_id FOR UPDATE;
  v_obra := nc_obra(p_nc_id);
  IF NOT FOUND OR NOT measurement_actor_can_manage(v_obra)
    OR NOT (SELECT controle_financeiro_nc_efetivo FROM obras WHERE id=v_obra) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o impacto financeiro' USING ERRCODE='insufficient_privilege';
  END IF;
  UPDATE nao_conformidades SET financeiro_requerido=true, situacao_financeira=p_situacao, bloqueio_medicao=p_bloqueio,
    justificativa_sem_impacto=CASE WHEN p_situacao='sem_impacto' THEN p_justificativa END,
    responsavel_avaliacao_id=CASE WHEN p_situacao='em_avaliacao' THEN p_responsavel_avaliacao END,
    prazo_avaliacao=CASE WHEN p_situacao='em_avaliacao' THEN p_prazo END,
    valor_estimado=CASE WHEN p_situacao='estimado' THEN p_valor_estimado END,
    valor_confirmado=CASE WHEN p_situacao='sem_impacto' THEN 0 WHEN p_situacao='confirmado' THEN p_valor_confirmado END,
    responsavel_financeiro=CASE WHEN p_situacao IN('estimado','confirmado') THEN p_responsavel_financeiro END,
    categoria_financeira=CASE WHEN p_situacao IN('estimado','confirmado') THEN p_categoria END,
    quantidade_bloqueada=NULL, percentual_bloqueado=NULL,
    valor_bloqueado=CASE WHEN p_bloqueio='parcial' THEN p_valor_bloqueado END,
    observacao_financeira=p_observacao, documento_financeiro_r2_key=p_documento, updated_at=now()
  WHERE id=p_nc_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.audit_nc_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='INSERT' OR ROW(NEW.situacao_financeira,NEW.bloqueio_medicao,NEW.justificativa_sem_impacto,NEW.responsavel_avaliacao_id,NEW.prazo_avaliacao,
    NEW.valor_estimado,NEW.valor_confirmado,NEW.responsavel_financeiro,NEW.categoria_financeira,NEW.quantidade_bloqueada,NEW.percentual_bloqueado,
    NEW.valor_bloqueado,NEW.observacao_financeira,NEW.documento_financeiro_r2_key)
    IS DISTINCT FROM ROW(OLD.situacao_financeira,OLD.bloqueio_medicao,OLD.justificativa_sem_impacto,OLD.responsavel_avaliacao_id,OLD.prazo_avaliacao,
    OLD.valor_estimado,OLD.valor_confirmado,OLD.responsavel_financeiro,OLD.categoria_financeira,OLD.quantidade_bloqueada,OLD.percentual_bloqueado,
    OLD.valor_bloqueado,OLD.observacao_financeira,OLD.documento_financeiro_r2_key) THEN
    INSERT INTO nc_financeiro_historico(cliente_id,nc_id,situacao,bloqueio,dados,alterado_por)
    VALUES(NEW.cliente_id,NEW.id,NEW.situacao_financeira,NEW.bloqueio_medicao,to_jsonb(NEW)-ARRAY['descricao','solucao_proposta']::text[],auth.uid());
  END IF; RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.avaliacao_empreiteiro_pode_editar(p_avaliacao_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a
    WHERE a.id=p_avaliacao_id AND a.status='rascunho' AND public.has_obra_access(a.obra_id)
      AND (a.avaliador_id=auth.uid() OR public.get_perfil() IN ('admin','gestor')))
$function$
;

CREATE OR REPLACE FUNCTION public.avaliacao_empreiteiro_pode_reabrir(p_avaliacao_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a
    WHERE a.id=p_avaliacao_id AND a.status='concluida' AND public.has_obra_access(a.obra_id)
      AND (a.avaliador_id=auth.uid() OR public.get_perfil() IN ('admin','gestor')))
$function$
;

CREATE OR REPLACE FUNCTION public.bloquear_edicao_medicao_avaliada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  IF TG_OP='UPDATE' AND NEW.status <> 'rascunho' THEN
    RETURN NEW; -- aprovação/cancelamento seguem seu fluxo controlado.
  END IF;
  IF EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a WHERE a.medicao_id=v_id AND a.status='concluida') THEN
    RAISE EXCEPTION 'A medição possui avaliação concluída; invalide-a antes de alterar a medição' USING ERRCODE='check_violation';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $function$
;

CREATE OR REPLACE FUNCTION public.bump_fvs_conclusao_counter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE fvs_planejadas
  SET total_conclusoes    = (SELECT COUNT(*) FROM fvs_conclusoes
                             WHERE fvs_planejada_id = NEW.fvs_planejada_id),
      ultima_conclusao_em = NEW.created_at,
      updated_at          = now()
  WHERE id = NEW.fvs_planejada_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bump_fvs_reabertura_counter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE fvs_planejadas
  SET total_reaberturas    = (SELECT COUNT(*) FROM fvs_reaberturas
                              WHERE fvs_planejada_id = NEW.fvs_planejada_id),
      ultima_reabertura_em = NEW.created_at,
      updated_at           = now()
  WHERE id = NEW.fvs_planejada_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_edit_verificacao(p_verificacao_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.verificacoes v WHERE v.id=p_verificacao_id AND public.has_verificacao_access(v.id) AND (v.inspetor_id=auth.uid() OR public.get_perfil() IN ('admin','gestor')))
$function$
;

CREATE OR REPLACE FUNCTION public.cancelar_medicao_servico(p_medicao_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE m medicoes_servico%ROWTYPE; actor uuid:=auth.uid();
BEGIN
  SELECT * INTO m FROM medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR NOT measurement_actor_can_manage(m.obra_id) OR NULLIF(trim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Cancelamento não autorizado ou sem justificativa' USING ERRCODE='check_violation'; END IF;
  IF m.status<>'aprovada' THEN RAISE EXCEPTION 'Somente medição aprovada pode ser cancelada' USING ERRCODE='check_violation'; END IF;
  PERFORM set_config('app.measurement_controlled_write','1',true);
  UPDATE medicao_item_liberacoes SET ativa=false WHERE medicao_item_id IN(SELECT id FROM medicao_servico_itens WHERE medicao_id=m.id);
  UPDATE medicoes_servico SET status='cancelada',cancelado_por=actor,cancelado_em=now(),motivo_cancelamento=trim(p_motivo),updated_at=now() WHERE id=m.id;
  INSERT INTO auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,dados,usuario_id)
  VALUES(m.cliente_id,m.obra_id,'medicao',m.id,'cancelada',jsonb_build_object('motivo',trim(p_motivo)),actor);
END $function$
;

CREATE OR REPLACE FUNCTION public.concluir_onboarding()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_concluido_em timestamptz;
BEGIN
  UPDATE public.usuarios
  SET
    onboarding_concluido_em = COALESCE(onboarding_concluido_em, now()),
    updated_at = now()
  WHERE id = auth.uid()
    AND perfil = 'admin'
    AND ativo = true
  RETURNING onboarding_concluido_em INTO v_concluido_em;

  IF v_concluido_em IS NULL THEN
    RAISE EXCEPTION 'Administrador ativo não encontrado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN v_concluido_em;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_modelos_medicao_empresa(p_empresa uuid, p_cliente uuid, p_usuario uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE modelo uuid; nomes text[]; titulo text; i integer;
BEGIN
  FOREACH titulo IN ARRAY ARRAY['Elétrica', 'Hidráulica', 'Incêndio'] LOOP
    INSERT INTO modelos_etapas_medicao(cliente_id, empresa_id, nome, ativo, criado_por)
    VALUES (p_cliente, p_empresa, titulo, true, p_usuario)
    ON CONFLICT (empresa_id, nome) DO NOTHING RETURNING id INTO modelo;
    IF modelo IS NULL THEN SELECT id INTO modelo FROM modelos_etapas_medicao WHERE empresa_id=p_empresa AND nome=titulo; END IF;
    nomes := CASE titulo
      WHEN 'Elétrica' THEN ARRAY['Infraestrutura, caixas e eletrodutos','Passagem de cabos','Montagem de quadros','Tomadas, interruptores e pontos','Testes e identificação','Documentação e entrega']
      WHEN 'Hidráulica' THEN ARRAY['Passagens e infraestrutura','Tubulação de água','Esgoto e ventilação','Testes de pressão e estanqueidade','Louças, metais e acabamentos','Documentação e entrega']
      ELSE ARRAY['Suportes e infraestrutura','Tubulações','Válvulas e equipamentos','Pontos e dispositivos','Testes e comissionamento','Documentação e entrega']
    END;
    FOR i IN 1..6 LOOP
      INSERT INTO modelo_etapas_medicao_itens(cliente_id, modelo_id, ordem, nome, peso_percentual)
      VALUES (p_cliente, modelo, i, nomes[i], CASE WHEN i = 6 THEN 16.6665 ELSE 16.6667 END)
      ON CONFLICT (modelo_id, ordem) DO NOTHING;
    END LOOP;
  END LOOP;
END $function$
;

CREATE OR REPLACE FUNCTION public.descartar_medicao_rascunho(p_medicao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_cliente_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  limite integer;
  consumo integer;
  coluna_limite text;
BEGIN
  IF NEW.cliente_id IS NULL OR NEW.ativo IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.ativo IS TRUE AND OLD.cliente_id = NEW.cliente_id THEN
    RETURN NEW;
  END IF;

  coluna_limite := CASE TG_TABLE_NAME
    WHEN 'usuarios' THEN 'limite_usuarios'
    WHEN 'empresas' THEN 'limite_empresas'
    WHEN 'obras' THEN 'limite_obras'
  END;
  EXECUTE format('SELECT %I FROM clientes WHERE id = $1 FOR UPDATE', coluna_limite)
    INTO limite USING NEW.cliente_id;
  IF limite IS NULL THEN RETURN NEW; END IF;

  EXECUTE format('SELECT count(*) FROM %I WHERE cliente_id = $1 AND ativo = true', TG_TABLE_NAME)
    INTO consumo USING NEW.cliente_id;
  IF consumo >= limite THEN
    RAISE EXCEPTION 'Limite de % atingido para este cliente', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_row_cliente_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_cliente uuid := get_cliente_id();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF caller_cliente IS NULL THEN
    RAISE EXCEPTION 'Usuário sem cliente operacional' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.cliente_id IS NULL THEN
    NEW.cliente_id := caller_cliente;
  ELSIF NEW.cliente_id <> caller_cliente THEN
    RAISE EXCEPTION 'Tentativa de gravação fora do cliente' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finalizar_avaliacao_empreiteiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_total numeric; v_obtido numeric; v_negativas integer; v_reabertura integer;
BEGIN
  IF OLD.status='concluida' AND NEW.status='rascunho' THEN
    IF NOT public.avaliacao_empreiteiro_pode_reabrir(OLD.id)
      OR length(trim(coalesce(NEW.ultimo_motivo_reabertura,''))) < 3 THEN
      RAISE EXCEPTION 'Reabertura não permitida' USING ERRCODE='check_violation';
    END IF;
    SELECT count(*)+1 INTO v_reabertura
    FROM public.avaliacao_empreiteiro_reaberturas WHERE avaliacao_id=OLD.id;
    INSERT INTO public.avaliacao_empreiteiro_reaberturas
      (cliente_id,avaliacao_id,avaliador_anterior_id,reaberto_por,motivo,numero_reabertura)
    VALUES
      (OLD.cliente_id,OLD.id,OLD.avaliador_id,auth.uid(),trim(NEW.ultimo_motivo_reabertura),v_reabertura);
    NEW.assinatura_url:=NULL; NEW.assinada_em:=NULL; NEW.concluida_em:=NULL;
    NEW.pontos_obtidos:=0; NEW.pontos_possiveis:=0; NEW.percentual:=0; NEW.updated_at:=now();
  ELSIF NEW.status='concluida' AND OLD.status='rascunho' THEN
    NEW.avaliador_id:=auth.uid();
    IF NEW.assinatura_url IS NULL OR NEW.assinada_em IS NULL THEN
      RAISE EXCEPTION 'Assinatura digital é obrigatória' USING ERRCODE='check_violation';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.equipes e WHERE e.id=NEW.equipe_id AND e.tipo='terceirizado' AND e.ativo)
      OR NOT EXISTS(SELECT 1 FROM public.obra_equipes oe WHERE oe.obra_id=NEW.obra_id AND oe.equipe_id=NEW.equipe_id) THEN
      RAISE EXCEPTION 'Selecione um empreiteiro ativo vinculado à obra' USING ERRCODE='check_violation';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.modelo_avaliacao_empreiteiro_revisoes r
      JOIN public.modelos_avaliacao_empreiteiro mo ON mo.id=r.modelo_id
      JOIN public.obras o ON o.id=NEW.obra_id
      WHERE r.id=NEW.modelo_revisao_id AND mo.cliente_id=NEW.cliente_id
        AND (mo.empresa_id IS NULL OR mo.empresa_id=o.empresa_id)) THEN
      RAISE EXCEPTION 'O modelo de avaliação não está disponível para esta obra' USING ERRCODE='check_violation';
    END IF;
    SELECT coalesce(sum(i.peso),0),coalesce(sum(CASE WHEN i.resultado='atende' THEN i.peso ELSE 0 END),0),
      count(*) FILTER (WHERE i.resultado='nao_atende')
    INTO v_total,v_obtido,v_negativas
    FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NOT NULL;
    IF v_total=0 OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NULL)
      OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado='nao_atende' AND length(trim(coalesce(i.comentario_nao_atende,'')))=0) THEN
      RAISE EXCEPTION 'Responda todos os critérios e justifique cada não atendimento' USING ERRCODE='check_violation';
    END IF;
    IF v_negativas>0 AND length(trim(coalesce(NEW.providencias_tomadas,'')))=0 THEN
      RAISE EXCEPTION 'Providências tomadas são obrigatórias quando há não atendimento' USING ERRCODE='check_violation';
    END IF;
    NEW.pontos_possiveis:=v_total; NEW.pontos_obtidos:=v_obtido;
    NEW.percentual:=round((v_obtido/nullif(v_total,0))*100,2);
    NEW.concluida_em:=coalesce(NEW.concluida_em,now()); NEW.updated_at:=now();
  ELSIF OLD.status='concluida' AND NEW.status IN ('aprovada','invalidada') THEN
    NULL;
  ELSIF OLD.status IN ('concluida','aprovada','invalidada') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Avaliação concluída, aprovada ou invalidada não pode ser alterada diretamente' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.fvs_medicao_obra(p_fvs uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT a.obra_id FROM fvs_planejadas f JOIN ambientes a ON a.id = f.ambiente_id WHERE f.id = p_fvs
$function$
;
