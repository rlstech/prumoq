-- Patch PrumoQ: Supabase -> Clerk + PowerSync (gerado por build-supabase.mjs; não editar à mão)
BEGIN;
SET LOCAL check_function_bodies = off;


-- 1) usuarios: ponte com o Clerk. Usuários novos não existem mais em auth.users.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS clerk_user_id text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS convite_enviado_em timestamp with time zone;
ALTER TABLE public.usuarios ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_clerk_user_id_key') THEN
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_clerk_user_id_key UNIQUE (clerk_user_id);
  END IF;
END
$$;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_id_fkey;
ALTER TABLE public.auditoria_plataforma DROP CONSTRAINT IF EXISTS auditoria_plataforma_ator_id_fkey;
-- e-mail e convite vinham de auth.users
UPDATE public.usuarios u SET email = au.email, convite_enviado_em = au.invited_at
  FROM auth.users au WHERE au.id = u.id AND u.email IS NULL;


-- 2) Identidade: sub do Clerk -> usuarios.id
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.id FROM public.usuarios u WHERE u.clerk_user_id = (auth.jwt() ->> 'sub')
$$;
REVOKE ALL ON FUNCTION public.current_usuario_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO authenticated;


-- 3) Funções base com public.current_usuario_id() -> current_usuario_id()

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
  IF v_origem_fvs IS NULL OR v_reinspecao_fvs IS NULL OR v_origem_fvs<>v_reinspecao_fvs OR NEW.inspetor_id<>public.current_usuario_id() THEN RAISE EXCEPTION 'Reinspecao fora do escopo autorizado' USING ERRCODE='insufficient_privilege'; END IF;
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
  SET status='aprovada', aprovada_por=public.current_usuario_id(), aprovada_em=now(), updated_at=now()
  WHERE id=a.id;
END $function$
;

CREATE OR REPLACE FUNCTION public.aprovar_medicao_servico(p_medicao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE m public.medicoes_servico%ROWTYPE; item record; saldo record; actor uuid:=public.current_usuario_id(); v_terceirizado boolean;
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
    VALUES(NEW.cliente_id,NEW.id,NEW.situacao_financeira,NEW.bloqueio_medicao,to_jsonb(NEW)-ARRAY['descricao','solucao_proposta']::text[],public.current_usuario_id());
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
      AND (a.avaliador_id=public.current_usuario_id() OR public.get_perfil() IN ('admin','gestor')))
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
      AND (a.avaliador_id=public.current_usuario_id() OR public.get_perfil() IN ('admin','gestor')))
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
  SELECT EXISTS (SELECT 1 FROM public.verificacoes v WHERE v.id=p_verificacao_id AND public.has_verificacao_access(v.id) AND (v.inspetor_id=public.current_usuario_id() OR public.get_perfil() IN ('admin','gestor')))
$function$
;

CREATE OR REPLACE FUNCTION public.cancelar_medicao_servico(p_medicao_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE m medicoes_servico%ROWTYPE; actor uuid:=public.current_usuario_id();
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
  WHERE id = public.current_usuario_id()
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
      (OLD.cliente_id,OLD.id,OLD.avaliador_id,public.current_usuario_id(),trim(NEW.ultimo_motivo_reabertura),v_reabertura);
    NEW.assinatura_url:=NULL; NEW.assinada_em:=NULL; NEW.concluida_em:=NULL;
    NEW.pontos_obtidos:=0; NEW.pontos_possiveis:=0; NEW.percentual:=0; NEW.updated_at:=now();
  ELSIF NEW.status='concluida' AND OLD.status='rascunho' THEN
    NEW.avaliador_id:=public.current_usuario_id();
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

CREATE OR REPLACE FUNCTION public.get_accessible_media_keys(p_keys text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT key FROM (
    SELECT vf.r2_key AS key FROM verificacao_fotos vf WHERE vf.r2_key = ANY(p_keys)
    UNION SELECT vf.r2_thumb_key FROM verificacao_fotos vf WHERE vf.r2_thumb_key = ANY(p_keys)
    UNION SELECT nf.r2_key FROM nc_fotos nf WHERE nf.r2_key = ANY(p_keys)
    UNION SELECT nf.r2_thumb_key FROM nc_fotos nf WHERE nf.r2_thumb_key = ANY(p_keys)
    UNION SELECT v.assinatura_url FROM verificacoes v WHERE v.assinatura_url = ANY(p_keys)
    UNION SELECT fc.assinatura_url FROM fvs_conclusoes fc WHERE fc.assinatura_url = ANY(p_keys)
    UNION SELECT nr.foto_url FROM nc_reinspecoes nr WHERE nr.foto_url = ANY(p_keys)
    UNION SELECT nc.foto_reinspecao_url FROM nao_conformidades nc WHERE nc.foto_reinspecao_url = ANY(p_keys)
    UNION SELECT u.assinatura_padrao_url FROM usuarios u
      WHERE u.id = public.current_usuario_id() AND u.assinatura_padrao_url = ANY(p_keys)
    UNION SELECT ae.assinatura_url FROM avaliacoes_empreiteiro ae
      WHERE ae.assinatura_url = ANY(p_keys)
  ) media WHERE key IS NOT NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ambientes_obra(p_obra_id uuid)
 RETURNS TABLE(id uuid, nome text, tipo text, localizacao text, total_fvs bigint, fvs_concluidas bigint, ncs_abertas bigint, progresso_percentual double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT
    a.id,
    a.nome,
    a.tipo::text,
    a.localizacao,
    COUNT(DISTINCT f.id),
    COUNT(DISTINCT CASE
      WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
    END),
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      JOIN verificacoes v ON v.id = n.verificacao_id
      JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
      WHERE fp2.ambiente_id = a.id
        AND n.status IN ('aberta', 'em_correcao')
    ),
    COALESCE(
      COUNT(DISTINCT CASE
        WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
      END)::double precision * 100.0 / NULLIF(COUNT(DISTINCT f.id), 0),
      0
    )
  FROM ambientes a
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE a.obra_id = p_obra_id
    AND a.ativo = true
  GROUP BY a.id
  ORDER BY a.nome;
$function$
;

CREATE OR REPLACE FUNCTION public.get_cliente_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT u.cliente_id FROM usuarios u
  WHERE u.id = public.current_usuario_id() AND u.ativo = true
$function$
;

CREATE OR REPLACE FUNCTION public.get_clientes_resumo()
 RETURNS TABLE(id uuid, nome text, slug text, status status_cliente, contato_nome text, contato_email text, contato_telefone text, limite_usuarios integer, limite_empresas integer, limite_obras integer, usuarios_ativos bigint, empresas_ativas bigint, obras_ativas bigint, admin_onboarding_status text, admin_convite_enviado_em timestamp with time zone, admin_onboarding_concluido_em timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à plataforma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nome,
    c.slug,
    c.status,
    c.contato_nome,
    c.contato_email,
    c.contato_telefone,
    c.limite_usuarios,
    c.limite_empresas,
    c.limite_obras,
    (SELECT count(*) FROM public.usuarios u WHERE u.cliente_id = c.id AND u.ativo),
    (SELECT count(*) FROM public.empresas e WHERE e.cliente_id = c.id AND e.ativo),
    (SELECT count(*) FROM public.obras o WHERE o.cliente_id = c.id AND o.ativo),
    CASE
      WHEN admin_info.usuario_id IS NULL THEN 'sem_administrador'
      WHEN admin_info.onboarding_concluido_em IS NULL THEN 'aguardando_ativacao'
      ELSE 'ativado'
    END,
    admin_info.invited_at,
    admin_info.onboarding_concluido_em,
    c.created_at
  FROM public.clientes c
  LEFT JOIN LATERAL (
    SELECT
      u.id AS usuario_id,
      u.onboarding_concluido_em,
      u.convite_enviado_em AS invited_at
    FROM public.usuarios u
    WHERE u.cliente_id = c.id
      AND u.perfil = 'admin'
    ORDER BY
      (lower(u.email) = lower(c.contato_email)) DESC,
      u.created_at ASC
    LIMIT 1
  ) AS admin_info ON true
  ORDER BY c.nome;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fotos_fvs(p_fvs_id uuid)
 RETURNS TABLE(id uuid, verificacao_id uuid, r2_key text, ordem integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT id, verificacao_id, r2_key, ordem
  FROM verificacao_fotos
  WHERE verificacao_id IN (
    SELECT id FROM verificacoes WHERE fvs_planejada_id = p_fvs_id
  )
  ORDER BY verificacao_id, ordem;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_ambiente(p_ambiente_id uuid)
 RETURNS TABLE(id uuid, subservico text, status text, total_verificacoes bigint, ultima_verif date, ncs_abertas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT
    fp.id,
    fp.subservico,
    fp.status::text,
    COUNT(DISTINCT v.id),
    MAX(v.data_verif),
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      JOIN verificacoes vn ON vn.id = n.verificacao_id
      WHERE vn.fvs_planejada_id = fp.id
        AND n.status IN ('aberta', 'em_correcao')
    )
  FROM fvs_planejadas fp
  LEFT JOIN verificacoes v ON v.fvs_planejada_id = fp.id
  WHERE fp.ambiente_id = p_ambiente_id
  GROUP BY fp.id
  ORDER BY fp.subservico;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_attachments(p_fvs_id uuid)
 RETURNS TABLE(id uuid, verificacao_id uuid, r2_key text, ordem integer, kind text, label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH target_fvs AS (
    SELECT fp.id FROM fvs_planejadas fp
    WHERE fp.id = p_fvs_id AND has_fvs_access(fp.id)
  ),
  report_verifications AS (
    SELECT v.id FROM verificacoes v
    JOIN target_fvs tf ON tf.id = v.fvs_planejada_id
  ),
  report_ncs AS (
    SELECT nc.id, nc.verificacao_id, nc.descricao, nc.foto_reinspecao_url
    FROM nao_conformidades nc
    JOIN report_verifications rv ON rv.id = nc.verificacao_id
  )
  SELECT vf.id, vf.verificacao_id, vf.r2_key, vf.ordem,
    'verification'::text, U&'Evid\00EAncia da verifica\00E7\00E3o'::text
  FROM verificacao_fotos vf JOIN report_verifications rv ON rv.id = vf.verificacao_id
  UNION ALL
  SELECT nf.id, nc.verificacao_id, nf.r2_key, nf.ordem,
    'nc'::text, U&'N\00E3o conformidade: ' || left(nc.descricao, 100)
  FROM nc_fotos nf JOIN report_ncs nc ON nc.id = nf.nc_id
  UNION ALL
  SELECT nr.id, nc.verificacao_id, nr.foto_url, 0,
    'reinspection'::text, U&'Reinspe\00E7\00E3o da n\00E3o conformidade'::text
  FROM nc_reinspecoes nr JOIN report_ncs nc ON nc.id = nr.nc_id
  WHERE nr.foto_url IS NOT NULL
  UNION ALL
  SELECT nc.id, nc.verificacao_id, nc.foto_reinspecao_url, 0,
    'reinspection'::text, U&'Reinspe\00E7\00E3o da n\00E3o conformidade'::text
  FROM report_ncs nc
  WHERE nc.foto_reinspecao_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM nc_reinspecoes nr
      WHERE nr.nc_id = nc.id AND nr.foto_url = nc.foto_reinspecao_url
    )
  ORDER BY 2, 5, 4, 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_detalhe(p_fvs_id uuid)
 RETURNS TABLE(id uuid, subservico text, status text, ambiente_nome text, obra_nome text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT fp.id, fp.subservico, fp.status,
         a.nome AS ambiente_nome, o.nome AS obra_nome
  FROM fvs_planejadas fp
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o     ON o.id = a.obra_id
  WHERE fp.id = p_fvs_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_header(p_fvs_id uuid)
 RETURNS TABLE(obra_nome text, obra_municipio text, obra_uf text, obra_endereco text, obra_eng_responsavel text, obra_crea_cau text, empresa_nome text, ambiente_nome text, ambiente_tipo text, ambiente_localizacao text, fvs_subservico text, fvs_status text, fvs_revisao text, fvs_concluida_em timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT
    o.nome, o.municipio, o.uf, o.endereco,
    o.eng_responsavel, o.crea_cau,
    e.nome,
    a.nome, a.tipo::text, a.localizacao,
    fp.subservico, fp.status::text, fp.revisao_associada::text, fp.concluida_em
  FROM fvs_planejadas fp
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o ON o.id = a.obra_id
  LEFT JOIN empresas e ON e.id = o.empresa_id
  WHERE fp.id = p_fvs_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_itens_checklist(p_fvs_id uuid)
 RETURNS TABLE(id uuid, ordem integer, titulo text, metodo_verif text, tolerancia text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT fpi.id, fpi.ordem, fpi.titulo, fpi.metodo_verif, fpi.tolerancia
  FROM fvs_padrao_itens fpi
  JOIN fvs_planejadas fp ON fp.fvs_padrao_id = fpi.fvs_padrao_id
    AND fpi.revisao = fp.revisao_associada
  WHERE fp.id = p_fvs_id
  ORDER BY fpi.ordem;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_abertas_inspetor(p_inspetor_id uuid)
 RETURNS TABLE(count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT COUNT(*) AS count
  FROM nao_conformidades n
  JOIN verificacoes v ON v.id = n.verificacao_id
  WHERE v.inspetor_id = p_inspetor_id AND n.status = 'aberta';
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_full()
 RETURNS TABLE(id uuid, descricao text, status text, data_nova_verif date, prioridade text, item_titulo text, ambiente_nome text, obra_nome text, responsavel_nome text, fvs_planejada_id uuid, obra_id uuid, ambiente_id uuid, prazo_correcao date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT n.id, n.descricao, n.status, n.data_nova_verif, n.prioridade,
         vi.titulo AS item_titulo,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         e.nome AS responsavel_nome,
         fp.id AS fvs_planejada_id,
         o.id AS obra_id, a.id AS ambiente_id,
         n.data_nova_verif AS prazo_correcao
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v        ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp     ON fp.id = v.fvs_planejada_id
  JOIN ambientes a           ON a.id = fp.ambiente_id
  JOIN obras o               ON o.id = a.obra_id
  LEFT JOIN equipes e        ON e.id = n.responsavel_id
  WHERE n.status != 'cancelada'
  ORDER BY n.data_nova_verif ASC NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_fvs(p_fvs_id uuid)
 RETURNS TABLE(id uuid, verificacao_id uuid, descricao text, solucao_proposta text, data_nova_verif date, status text, item_titulo text, responsavel_nome text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT n.id, n.verificacao_id, n.descricao, n.solucao_proposta,
         n.data_nova_verif, n.status, vi.titulo AS item_titulo,
         e.nome AS responsavel_nome
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  LEFT JOIN equipes e       ON e.id = n.responsavel_id
  WHERE n.verificacao_id IN (
    SELECT id FROM verificacoes WHERE fvs_planejada_id = p_fvs_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_urgentes()
 RETURNS TABLE(id uuid, item_titulo text, descricao text, ambiente_nome text, obra_nome text, subservico text, prioridade text, equipe_nome text, data_nova_verif date, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT n.id, vi.titulo AS item_titulo, n.descricao,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         fp.subservico,
         n.prioridade,
         eq.nome AS equipe_nome,
         n.data_nova_verif,
         n.status::text
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v        ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp     ON fp.id = v.fvs_planejada_id
  JOIN ambientes a           ON a.id = fp.ambiente_id
  JOIN obras o               ON o.id = a.obra_id
  LEFT JOIN equipes eq       ON eq.id = n.responsavel_id
  WHERE n.status IN ('aberta', 'em_correcao')
  ORDER BY n.data_nova_verif ASC NULLS LAST
  LIMIT 5;
$function$
;

CREATE OR REPLACE FUNCTION public.get_obra_kpi(p_obra_id uuid)
 RETURNS TABLE(total_ambientes bigint, total_fvs bigint, fvs_concluidas bigint, ncs_abertas bigint, progresso_percentual double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT
    COUNT(DISTINCT a.id),
    COUNT(DISTINCT f.id),
    COUNT(DISTINCT CASE
      WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
    END),
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      JOIN verificacoes v ON v.id = n.verificacao_id
      JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
      JOIN ambientes a2 ON a2.id = fp2.ambiente_id
      WHERE a2.obra_id = p_obra_id
        AND a2.ativo = true
        AND n.status IN ('aberta', 'em_correcao')
    ),
    COALESCE(
      COUNT(DISTINCT CASE
        WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
      END)::double precision * 100.0 / NULLIF(COUNT(DISTINCT f.id), 0),
      0
    )
  FROM obras o
  LEFT JOIN ambientes a ON a.obra_id = o.id AND a.ativo = true
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE o.id = p_obra_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_obras_acesso()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select obra_id from obra_usuarios
  where usuario_id = public.current_usuario_id() and ativo = true
$function$
;

CREATE OR REPLACE FUNCTION public.get_obras_com_fvs()
 RETURNS TABLE(id uuid, nome text, status text, endereco text, municipio text, uf text, engenheiro_nome text, engenheiro_crea text, empresa_nome text, total_ambientes bigint, total_fvs bigint, fvs_concluidas bigint, progresso_percentual double precision, ncs_abertas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT id, nome, status, endereco, municipio, uf,
         engenheiro_nome, engenheiro_crea, empresa_nome,
         total_ambientes, total_fvs, fvs_concluidas,
         progresso_percentual, ncs_abertas
  FROM v_obras_com_fvs;
$function$
;

CREATE OR REPLACE FUNCTION public.get_obras_progresso_dashboard()
 RETURNS TABLE(id uuid, nome text, status text, municipio text, uf text, empresa_nome text, total_ambientes bigint, total_fvs bigint, fvs_concluidas bigint, progresso_percentual double precision, ncs_abertas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT
    v.id,
    v.nome,
    v.status::text,
    v.municipio,
    v.uf,
    v.empresa_nome,
    v.total_ambientes,
    v.total_fvs,
    v.fvs_concluidas,
    v.progresso_percentual,
    v.ncs_abertas
  FROM public.v_obras_com_fvs v
  ORDER BY v.nome
  LIMIT 5;
$function$
;

CREATE OR REPLACE FUNCTION public.get_perfil()
 RETURNS perfil_usuario
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT u.perfil FROM usuarios u
  WHERE u.id = public.current_usuario_id() AND u.ativo = true
$function$
;

CREATE OR REPLACE FUNCTION public.get_usuarios_com_obras()
 RETURNS TABLE(id uuid, nome text, email character varying, perfil text, cargo text, ativo boolean, obras_acesso jsonb, ultimo_acesso timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF public.get_perfil() NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado. Requer perfil admin ou gestor.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.nome,
    u.email::varchar,
    u.perfil::text,
    u.cargo,
    u.ativo,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome))
        FROM obra_usuarios ou
        JOIN obras o ON o.id = ou.obra_id
        WHERE ou.usuario_id = u.id
      ),
      '[]'::jsonb
    ) AS obras_acesso,
    NULL::timestamptz
  FROM public.usuarios u;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_verificacoes_fvs(p_fvs_id uuid)
 RETURNS TABLE(id uuid, numero_verif integer, data_verif date, status text, observacoes text, assinatura_url text, percentual_exec integer, created_offline boolean, inspetor_nome text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT v.id, v.numero_verif, v.data_verif, v.status,
         v.observacoes, v.assinatura_url, v.percentual_exec,
         v.created_offline, u.nome AS inspetor_nome,
         v.created_at
  FROM verificacoes v
  LEFT JOIN usuarios u ON u.id = v.inspetor_id
  WHERE v.fvs_planejada_id = p_fvs_id
  ORDER BY v.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_verificacoes_recentes()
 RETURNS TABLE(id uuid, status text, data_verif date, ambiente_nome text, obra_nome text, fvs_nome text, fvs_planejada_id uuid, ambiente_id uuid, obra_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
    SELECT v.id, v.status, v.data_verif,
           a.nome AS ambiente_nome, o.nome AS obra_nome,
           fp.subservico AS fvs_nome,
           fp.id AS fvs_planejada_id,
           a.id  AS ambiente_id,
           o.id  AS obra_id
    FROM verificacoes v
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a        ON a.id = fp.ambiente_id
    JOIN obras o            ON o.id = a.obra_id
    ORDER BY v.data_verif DESC
    LIMIT 3;
  $function$
;

CREATE OR REPLACE FUNCTION public.has_ambiente_access(p_ambiente_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM ambientes a
    WHERE a.id = p_ambiente_id AND has_obra_access(a.obra_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.has_cliente_access(p_cliente_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    JOIN clientes c ON c.id = u.cliente_id
    WHERE u.id = public.current_usuario_id() AND u.ativo = true
      AND c.status = 'ativo' AND u.cliente_id = p_cliente_id
  )
$function$
;

CREATE OR REPLACE FUNCTION public.has_fvs_access(p_fvs_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM fvs_planejadas fp
    JOIN ambientes a ON a.id = fp.ambiente_id
    WHERE fp.id = p_fvs_id AND has_obra_access(a.obra_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.has_nc_access(p_nc_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM nao_conformidades nc
    WHERE nc.id = p_nc_id AND has_verificacao_access(nc.verificacao_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.has_obra_access(p_obra_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM obras o
    JOIN usuarios u ON u.id = public.current_usuario_id() AND u.cliente_id = o.cliente_id
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.id = p_obra_id AND u.ativo = true AND c.status = 'ativo'
      AND (
        u.perfil = 'admin'
        OR EXISTS (
          SELECT 1 FROM obra_usuarios ou
          WHERE ou.obra_id = o.id AND ou.usuario_id = u.id AND ou.ativo = true
        )
      )
  )
$function$
;

CREATE OR REPLACE FUNCTION public.has_verificacao_access(p_verificacao_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM verificacoes v
    WHERE v.id = p_verificacao_id AND has_fvs_access(v.fvs_planejada_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.invalidar_avaliacao_empreiteiro(p_avaliacao_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.avaliacoes_empreiteiro%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.avaliacoes_empreiteiro WHERE id=p_avaliacao_id FOR UPDATE;
  IF NOT FOUND OR public.get_perfil() NOT IN ('admin','gestor') OR NOT public.has_obra_access(a.obra_id)
    OR a.status<>'concluida' OR length(trim(coalesce(p_motivo,'')))<3 THEN
    RAISE EXCEPTION 'Invalidação não permitida' USING ERRCODE='check_violation';
  END IF;
  UPDATE public.avaliacoes_empreiteiro
  SET status='invalidada', invalidada_por=public.current_usuario_id(), invalidada_em=now(), motivo_invalidacao=trim(p_motivo), updated_at=now()
  WHERE id=a.id;
END $function$
;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = public.current_usuario_id() AND u.ativo = true
      AND u.perfil = 'superadmin' AND u.cliente_id IS NULL
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_tenant_media_key(p_key text, p_cliente_id uuid)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT p_key ~ ('^fotos/' || p_cliente_id::text || '/[0-9a-f-]{36}/.+') $function$
;

CREATE OR REPLACE FUNCTION public.measurement_actor_can_manage(p_obra_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.current_usuario_id() IS NOT NULL
     AND get_perfil() IN ('admin', 'gestor')
     AND has_obra_access(p_obra_id)
$function$
;

CREATE OR REPLACE FUNCTION public.nc_obra(p_nc uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT fvs_medicao_obra(v.fvs_planejada_id) FROM nao_conformidades n JOIN verificacoes v ON v.id = n.verificacao_id WHERE n.id = p_nc
$function$
;

CREATE OR REPLACE FUNCTION public.next_numero_verif(p_fvs_planejada_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select coalesce(max(numero_verif), 0) + 1
  from verificacoes
  where fvs_planejada_id = p_fvs_planejada_id
$function$
;

CREATE OR REPLACE FUNCTION public.protect_medicao_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF EXISTS(SELECT 1 FROM public.medicoes_servico h JOIN public.medicao_servico_itens i ON i.medicao_id=h.id WHERE i.id=v_item_id AND h.status<>'rascunho') THEN
      RAISE EXCEPTION 'Itens de medição aprovada ou cancelada são imutáveis' USING ERRCODE='check_violation';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.protect_usuario_self_service_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.current_usuario_id() = OLD.id AND get_perfil() <> 'admin' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.cargo IS DISTINCT FROM OLD.cargo
       OR NEW.telefone IS DISTINCT FROM OLD.telefone
       OR NEW.perfil IS DISTINCT FROM OLD.perfil
       OR NEW.ativo IS DISTINCT FROM OLD.ativo
       OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
       OR NEW.onboarding_concluido_em IS DISTINCT FROM OLD.onboarding_concluido_em THEN
      RAISE EXCEPTION 'Apenas a assinatura padrão pode ser atualizada pelo próprio usuário'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.proteger_historico_avanco_aprovado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Avanços aprovados não podem ser excluídos' USING ERRCODE='check_violation';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Avanços aprovados não podem ser alterados' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.publicar_modelo_avaliacao_empreiteiro(p_modelo_id uuid, p_empresa_id uuid, p_nome text, p_descricao text, p_ativo boolean, p_descricao_alteracoes text, p_criterios jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_cliente uuid:=public.get_cliente_id(); v_modelo uuid:=coalesce(p_modelo_id,public.uuid_generate_v4()); v_revisao integer; v_item jsonb;
BEGIN
  IF public.current_usuario_id() IS NULL OR public.get_perfil()<>'admin' OR v_cliente IS NULL THEN RAISE EXCEPTION 'Somente administradores podem publicar modelos' USING ERRCODE='insufficient_privilege'; END IF;
  IF nullif(trim(p_nome),'') IS NULL OR nullif(trim(p_descricao_alteracoes),'') IS NULL OR jsonb_typeof(p_criterios)<>'array' OR jsonb_array_length(p_criterios)=0 THEN RAISE EXCEPTION 'Nome, alterações e critérios são obrigatórios' USING ERRCODE='check_violation'; END IF;
  IF p_empresa_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.empresas e WHERE e.id=p_empresa_id AND e.cliente_id=v_cliente) THEN RAISE EXCEPTION 'Empresa fora do escopo' USING ERRCODE='insufficient_privilege'; END IF;
  INSERT INTO public.modelos_avaliacao_empreiteiro(id,cliente_id,empresa_id,nome,descricao,ativo,criado_por)
  VALUES(v_modelo,v_cliente,p_empresa_id,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),p_ativo,public.current_usuario_id())
  ON CONFLICT(id) DO UPDATE SET empresa_id=excluded.empresa_id,nome=excluded.nome,descricao=excluded.descricao,ativo=excluded.ativo,updated_at=now()
  WHERE public.modelos_avaliacao_empreiteiro.cliente_id=v_cliente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado' USING ERRCODE='no_data_found'; END IF;
  SELECT revisao_atual+1 INTO v_revisao FROM public.modelos_avaliacao_empreiteiro WHERE id=v_modelo FOR UPDATE;
  INSERT INTO public.modelo_avaliacao_empreiteiro_revisoes(cliente_id,modelo_id,numero_revisao,descricao_alteracoes,publicado_por)
  VALUES(v_cliente,v_modelo,v_revisao,trim(p_descricao_alteracoes),public.current_usuario_id()) RETURNING id INTO v_modelo;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_criterios) LOOP
    INSERT INTO public.modelo_avaliacao_empreiteiro_criterios(cliente_id,revisao_id,ordem,titulo,peso)
    VALUES(v_cliente,v_modelo,(v_item->>'ordem')::integer,trim(v_item->>'titulo'),(v_item->>'peso')::smallint);
  END LOOP;
  UPDATE public.modelos_avaliacao_empreiteiro SET revisao_atual=v_revisao,updated_at=now() WHERE id=(SELECT modelo_id FROM public.modelo_avaliacao_empreiteiro_revisoes WHERE id=v_modelo);
  RETURN v_modelo;
END $function$
;

CREATE OR REPLACE FUNCTION public.reabrir_avaliacao_empreiteiro(p_avaliacao_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.avaliacoes_empreiteiro
  SET status='rascunho',ultimo_motivo_reabertura=trim(p_motivo),updated_at=now()
  WHERE id=p_avaliacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reabertura não permitida' USING ERRCODE='check_violation'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.refresh_obra_feature_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE obras o
  SET controle_medicoes_efetivo = COALESCE(o.controle_medicoes_override, e.controle_medicoes_habilitado),
      controle_financeiro_nc_efetivo = COALESCE(o.controle_financeiro_nc_override, e.controle_financeiro_nc_habilitado)
  FROM empresas e WHERE e.id = o.empresa_id AND e.cliente_id = o.cliente_id;
  RETURN NULL;
END $function$
;

CREATE OR REPLACE FUNCTION public.registrar_avanco_aprovado(p_id uuid, p_vinculo_id uuid, p_verificacao_id uuid, p_executado_atual numeric, p_aprovado_atual numeric, p_created_offline boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    v_unidade, public.current_usuario_id(), p_created_offline
  );
  RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.saldo_vinculo_execucao(p_vinculo uuid)
 RETURNS TABLE(aprovado numeric, medido numeric, bloqueado numeric, disponivel numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH scope AS (SELECT escopo_atribuido FROM vinculos_execucao_servico WHERE id=p_vinculo),
  a AS (SELECT COALESCE(max(aprovado_atual),0) v FROM avancos_aprovados_servico WHERE vinculacao_id=p_vinculo),
  m AS (SELECT COALESCE(sum(i.quantidade_periodo),0) v FROM medicao_servico_itens i JOIN medicoes_servico h ON h.id=i.medicao_id
        WHERE i.vinculacao_id=p_vinculo AND i.tipo='avanco' AND h.status='aprovada'),
  b AS (SELECT bool_or(n.bloqueio_medicao='total') total,
        COALESCE(sum(CASE WHEN n.bloqueio_medicao='parcial'
          THEN COALESCE(n.valor_bloqueado / NULLIF(c.preco_unitario,0),
                        n.quantidade_bloqueada,
                        (n.percentual_bloqueado/100)*scope.escopo_atribuido, 0)
          ELSE 0 END),0) parcial
        FROM scope,nao_conformidades n JOIN verificacoes ver ON ver.id=n.verificacao_id
        JOIN avancos_aprovados_servico aa ON aa.verificacao_id=ver.id
        LEFT JOIN fvs_medicao_configuracoes c ON c.fvs_planejada_id=ver.fvs_planejada_id
        WHERE aa.vinculacao_id=p_vinculo AND n.status IN ('aberta','em_correcao')
          AND n.responsavel_financeiro='empreiteiro')
  SELECT a.v,m.v,CASE WHEN b.total THEN greatest(a.v-m.v,0) ELSE least(b.parcial,greatest(a.v-m.v,0)) END,
    CASE WHEN b.total THEN 0 ELSE greatest(0,a.v-m.v-b.parcial) END FROM a,m,b
$function$
;

CREATE OR REPLACE FUNCTION public.salvar_configuracao_medicao_fvs(p_fvs_id uuid, p_metodo metodo_medicao_servico, p_unidade text, p_quantidade_total numeric, p_preco_unitario numeric, p_permite_parciais boolean, p_modelo_id uuid, p_etapas jsonb, p_equipe_inicial_id uuid, p_data_inicio date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_obra_id uuid := fvs_medicao_obra(p_fvs_id);
  v_cliente_id uuid;
  v_config_id uuid;
  v_item jsonb;
  v_etapa_id uuid;
  v_total_pesos numeric;
BEGIN
  IF NOT measurement_actor_can_manage(v_obra_id) THEN RAISE EXCEPTION 'Sem permissão para configurar a medição' USING ERRCODE='insufficient_privilege'; END IF;
  SELECT cliente_id INTO v_cliente_id FROM obras WHERE id=v_obra_id AND controle_medicoes_efetivo;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE='check_violation'; END IF;
  IF p_quantidade_total <= 0 OR NULLIF(trim(p_unidade),'') IS NULL OR COALESCE(p_preco_unitario,0) < 0 THEN
    RAISE EXCEPTION 'Unidade, quantidade e preço são inválidos' USING ERRCODE='check_violation';
  END IF;
  IF p_metodo='unidade_concluida' AND (p_quantidade_total<>1 OR p_permite_parciais) THEN
    RAISE EXCEPTION 'Unidade concluída deve possuir total 1 e não aceitar parciais' USING ERRCODE='check_violation';
  END IF;
  IF p_metodo='etapas_ponderadas' THEN
    SELECT COALESCE(sum((e->>'peso_percentual')::numeric) FILTER (WHERE COALESCE((e->>'ativo')::boolean,true)),0)
      INTO v_total_pesos FROM jsonb_array_elements(COALESCE(p_etapas,'[]'::jsonb)) e;
    IF v_total_pesos<>100.0000 THEN RAISE EXCEPTION 'Os pesos ativos devem somar exatamente 100%%' USING ERRCODE='check_violation'; END IF;
    p_quantidade_total := 100; p_unidade := '%';
  END IF;
  IF p_equipe_inicial_id IS NULL OR NOT EXISTS(SELECT 1 FROM obra_equipes WHERE obra_id=v_obra_id AND equipe_id=p_equipe_inicial_id) THEN
    RAISE EXCEPTION 'Selecione uma equipe vinculada à obra' USING ERRCODE='check_violation';
  END IF;
  SELECT id INTO v_config_id FROM fvs_medicao_configuracoes WHERE fvs_planejada_id=p_fvs_id FOR UPDATE;
  IF v_config_id IS NOT NULL AND (EXISTS(SELECT 1 FROM avancos_aprovados_servico a JOIN vinculos_execucao_servico v ON v.id=a.vinculacao_id WHERE v.fvs_planejada_id=p_fvs_id)
    OR EXISTS(SELECT 1 FROM medicao_servico_itens i JOIN vinculos_execucao_servico v ON v.id=i.vinculacao_id WHERE v.fvs_planejada_id=p_fvs_id)) THEN
    RAISE EXCEPTION 'Configuração com histórico não pode ser substituída; encerre os vínculos ou mantenha os parâmetros' USING ERRCODE='check_violation';
  END IF;
  IF v_config_id IS NULL THEN v_config_id:=uuid_generate_v4(); ELSE
    DELETE FROM vinculos_execucao_servico WHERE fvs_planejada_id=p_fvs_id;
    DELETE FROM fvs_medicao_etapas WHERE configuracao_id=v_config_id;
  END IF;
  INSERT INTO fvs_medicao_configuracoes(id,cliente_id,fvs_planejada_id,metodo,unidade,quantidade_total,preco_unitario,permite_medicoes_parciais,modelo_origem_id,criado_por,updated_by)
  VALUES(v_config_id,v_cliente_id,p_fvs_id,p_metodo,trim(p_unidade),p_quantidade_total,p_preco_unitario,p_permite_parciais,p_modelo_id,public.current_usuario_id(),public.current_usuario_id())
  ON CONFLICT(id) DO UPDATE SET metodo=EXCLUDED.metodo,unidade=EXCLUDED.unidade,quantidade_total=EXCLUDED.quantidade_total,
    preco_unitario=EXCLUDED.preco_unitario,permite_medicoes_parciais=EXCLUDED.permite_medicoes_parciais,
    modelo_origem_id=EXCLUDED.modelo_origem_id,updated_by=public.current_usuario_id(),updated_at=now();
  IF p_metodo='etapas_ponderadas' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_etapas) LOOP
      v_etapa_id:=uuid_generate_v4();
      INSERT INTO fvs_medicao_etapas(id,cliente_id,configuracao_id,ordem,nome,peso_percentual,permite_avanco_parcial,ativo,equipe_responsavel_id,updated_by)
      VALUES(v_etapa_id,v_cliente_id,v_config_id,(v_item->>'ordem')::integer,trim(v_item->>'nome'),(v_item->>'peso_percentual')::numeric,
        COALESCE((v_item->>'permite_avanco_parcial')::boolean,false),COALESCE((v_item->>'ativo')::boolean,true),p_equipe_inicial_id,public.current_usuario_id());
      IF COALESCE((v_item->>'ativo')::boolean,true) THEN
        INSERT INTO vinculos_execucao_servico(cliente_id,fvs_planejada_id,etapa_id,equipe_id,data_inicio,escopo_atribuido,criado_por)
        VALUES(v_cliente_id,p_fvs_id,v_etapa_id,p_equipe_inicial_id,COALESCE(p_data_inicio,current_date),(v_item->>'peso_percentual')::numeric,public.current_usuario_id());
      END IF;
    END LOOP;
  ELSE
    INSERT INTO vinculos_execucao_servico(cliente_id,fvs_planejada_id,equipe_id,data_inicio,escopo_atribuido,criado_por)
    VALUES(v_cliente_id,p_fvs_id,p_equipe_inicial_id,COALESCE(p_data_inicio,current_date),p_quantidade_total,public.current_usuario_id());
  END IF;
  INSERT INTO auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,dados,usuario_id)
  VALUES(v_cliente_id,v_obra_id,'fvs_medicao_configuracao',v_config_id,'configurada',jsonb_build_object('metodo',p_metodo,'total',p_quantidade_total),public.current_usuario_id());
  RETURN v_config_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.salvar_medicao_rascunho(p_medicao_id uuid, p_obra_id uuid, p_equipe_id uuid, p_referencia text, p_periodo_inicio date, p_periodo_fim date, p_data_medicao date, p_observacao text, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF NOT EXISTS(SELECT 1 FROM public.obra_equipes WHERE obra_id=p_obra_id AND equipe_id=p_equipe_id) THEN
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
      p_periodo_fim,COALESCE(p_data_medicao,current_date),p_observacao,public.current_usuario_id());
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
$function$
;

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
  IF public.current_usuario_id() IS NULL OR get_perfil() <> 'admin' THEN
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
  VALUES(v_modelo_id,v_cliente_id,p_empresa_id,trim(p_nome),p_ativo,public.current_usuario_id())
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
  v_actor uuid := public.current_usuario_id();
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
  PERFORM criar_modelos_medicao_empresa(NEW.id, NEW.cliente_id, public.current_usuario_id());
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
  v_actor uuid:=public.current_usuario_id();
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
  IF public.current_usuario_id() IS NOT NULL THEN NEW.aprovado_por := public.current_usuario_id(); END IF;

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


-- 4) Policies que usavam public.current_usuario_id()

DROP POLICY IF EXISTS avaliacoes_empreiteiro_insert ON public.avaliacoes_empreiteiro;
CREATE POLICY avaliacoes_empreiteiro_insert ON public.avaliacoes_empreiteiro AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_obra_access(obra_id) AND (avaliador_id = public.current_usuario_id()) AND (status = 'rascunho'::status_avaliacao_empreiteiro) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario, 'inspetor'::perfil_usuario]))));
DROP POLICY IF EXISTS avaliacoes_empreiteiro_update ON public.avaliacoes_empreiteiro;
CREATE POLICY avaliacoes_empreiteiro_update ON public.avaliacoes_empreiteiro AS PERMISSIVE FOR UPDATE TO public USING ((avaliacao_empreiteiro_pode_editar(id) OR avaliacao_empreiteiro_pode_reabrir(id))) WITH CHECK ((has_obra_access(obra_id) AND ((avaliador_id = public.current_usuario_id()) OR (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))));
DROP POLICY IF EXISTS fvs_conclusoes_insert ON public.fvs_conclusoes;
CREATE POLICY fvs_conclusoes_insert ON public.fvs_conclusoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (inspetor_id = public.current_usuario_id())));
DROP POLICY IF EXISTS fvs_reaberturas_insert ON public.fvs_reaberturas;
CREATE POLICY fvs_reaberturas_insert ON public.fvs_reaberturas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (solicitado_por = public.current_usuario_id())));
DROP POLICY IF EXISTS nc_reinspecoes_insert ON public.nc_reinspecoes;
CREATE POLICY nc_reinspecoes_insert ON public.nc_reinspecoes AS PERMISSIVE FOR INSERT TO public WITH CHECK (((inspetor_id = public.current_usuario_id()) AND can_edit_verificacao(verificacao_id) AND (EXISTS ( SELECT 1
   FROM ((nao_conformidades nc
     JOIN verificacoes origem ON ((origem.id = nc.verificacao_id)))
     JOIN verificacoes reinspecao ON ((reinspecao.id = nc.verificacao_id)))
  WHERE ((nc.id = nc_reinspecoes.nc_id) AND (origem.fvs_planejada_id = reinspecao.fvs_planejada_id))))));
DROP POLICY IF EXISTS usuarios_assinatura_padrao_propria ON public.usuarios;
CREATE POLICY usuarios_assinatura_padrao_propria ON public.usuarios AS PERMISSIVE FOR UPDATE TO public USING ((id = public.current_usuario_id())) WITH CHECK (((id = public.current_usuario_id()) AND (cliente_id = get_cliente_id())));
DROP POLICY IF EXISTS usuarios_tenant_select ON public.usuarios;
CREATE POLICY usuarios_tenant_select ON public.usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (((id = public.current_usuario_id()) OR ((cliente_id IS NOT NULL) AND has_cliente_access(cliente_id))));
DROP POLICY IF EXISTS verificacoes_insert ON public.verificacoes;
CREATE POLICY verificacoes_insert ON public.verificacoes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (inspetor_id = public.current_usuario_id())));
DROP POLICY IF EXISTS verificacoes_update ON public.verificacoes;
CREATE POLICY verificacoes_update ON public.verificacoes AS PERMISSIVE FOR UPDATE TO public USING (can_edit_verificacao(id)) WITH CHECK ((has_fvs_access(fvs_planejada_id) AND ((inspetor_id = public.current_usuario_id()) OR ((get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])) AND (EXISTS ( SELECT 1
   FROM usuarios u
  WHERE ((u.id = verificacoes.inspetor_id) AND (u.cliente_id = get_cliente_id()) AND u.ativo)))))));

-- 5) Funções novas e obra_id do PowerSync

-- Funções novas do Neon (não existiam no Supabase). Substituem os usos da service role no painel web.
-- Cada uma valida o chamador DENTRO do banco; o app não precisa mais de uma chave que ignore a RLS.

-- Antes: deleteObra() usava a service role porque obras não tem policy de DELETE.
CREATE OR REPLACE FUNCTION public.excluir_obra(p_obra_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente uuid;
  v_amb integer;
  v_usr integer;
  v_eq integer;
  v_del integer;
BEGIN
  IF get_perfil() IS DISTINCT FROM 'admin' OR NOT has_obra_access(p_obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta obra' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT cliente_id INTO v_cliente FROM obras WHERE id = p_obra_id;
  SELECT count(*) INTO v_amb FROM ambientes WHERE obra_id = p_obra_id AND cliente_id = v_cliente;
  SELECT count(*) INTO v_usr FROM obra_usuarios WHERE obra_id = p_obra_id AND cliente_id = v_cliente;
  SELECT count(*) INTO v_eq FROM obra_equipes WHERE obra_id = p_obra_id AND cliente_id = v_cliente;
  IF v_amb + v_usr + v_eq > 0 THEN
    RETURN jsonb_build_object('deleted', false, 'ambientes', v_amb, 'usuarios', v_usr, 'equipes', v_eq);
  END IF;
  DELETE FROM obras WHERE id = p_obra_id AND cliente_id = v_cliente;
  GET DIAGNOSTICS v_del = ROW_COUNT;
  RETURN jsonb_build_object('deleted', v_del > 0, 'ambientes', 0, 'usuarios', 0, 'equipes', 0);
END
$function$;

-- Antes: createCliente() usava a service role (clientes sem INSERT policy; usuarios de outro tenant;
-- auditoria_plataforma sem INSERT policy). A conta no Clerk é criada pelo servidor ANTES; aqui entra só o banco.
CREATE OR REPLACE FUNCTION public.plataforma_criar_cliente(
  p_nome text, p_slug text, p_contato_nome text, p_contato_email text, p_contato_telefone text,
  p_limite_usuarios integer, p_limite_empresas integer, p_limite_obras integer, p_admin_clerk_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente uuid;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à plataforma' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NULLIF(trim(p_admin_clerk_id), '') IS NULL THEN
    RAISE EXCEPTION 'Conta do administrador inicial não informada' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO clientes(nome, slug, contato_nome, contato_email, contato_telefone, limite_usuarios, limite_empresas, limite_obras)
  VALUES (p_nome, p_slug, NULLIF(p_contato_nome, ''), p_contato_email, NULLIF(p_contato_telefone, ''),
          p_limite_usuarios, p_limite_empresas, p_limite_obras)
  RETURNING id INTO v_cliente;
  INSERT INTO usuarios(cliente_id, nome, perfil, ativo, clerk_user_id, email, convite_enviado_em)
  VALUES (v_cliente, COALESCE(NULLIF(p_contato_nome, ''), p_nome), 'admin', true, p_admin_clerk_id,
          lower(p_contato_email), now());
  INSERT INTO auditoria_plataforma(ator_id, cliente_id, acao, detalhes)
  VALUES (current_usuario_id(), v_cliente, 'cliente_criado',
          jsonb_build_object('nome', p_nome, 'slug', p_slug, 'admin_email', p_contato_email));
  RETURN v_cliente;
END
$function$;

-- Antes: updateCliente() gravava a auditoria pela service role.
CREATE OR REPLACE FUNCTION public.plataforma_atualizar_cliente(
  p_id uuid, p_nome text, p_slug text, p_contato_nome text, p_contato_email text, p_contato_telefone text,
  p_limite_usuarios integer, p_limite_empresas integer, p_limite_obras integer, p_status status_cliente,
  p_detalhes jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à plataforma' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE clientes SET nome = p_nome, slug = p_slug, contato_nome = NULLIF(p_contato_nome, ''),
    contato_email = NULLIF(p_contato_email, ''), contato_telefone = NULLIF(p_contato_telefone, ''),
    limite_usuarios = p_limite_usuarios, limite_empresas = p_limite_empresas, limite_obras = p_limite_obras,
    status = p_status
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO auditoria_plataforma(ator_id, cliente_id, acao, detalhes)
  VALUES (current_usuario_id(), p_id,
          CASE WHEN p_status = 'suspenso' THEN 'cliente_suspenso' ELSE 'cliente_atualizado' END, p_detalhes);
END
$function$;

-- Antes: createUsuario() inseria em usuarios e depois em obra_usuarios; se o 2º passo falhava, o ON DELETE
-- CASCADE da FK para a tabela de usuários do Supabase limpava o 1º. Sem essa FK, o par precisa ser atômico. SECURITY INVOKER de propósito:
-- as policies de usuarios/obra_usuarios (admin do próprio cliente) continuam sendo a regra de acesso.
CREATE OR REPLACE FUNCTION public.criar_usuario(
  p_clerk_user_id text, p_email text, p_nome text, p_cargo text, p_perfil perfil_usuario, p_obras uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
  v_cliente uuid := get_cliente_id();
  v_obra uuid;
BEGIN
  INSERT INTO usuarios(clerk_user_id, email, cliente_id, nome, cargo, perfil, ativo)
  VALUES (p_clerk_user_id, lower(p_email), v_cliente, p_nome, NULLIF(p_cargo, ''), p_perfil, true)
  RETURNING id INTO v_id;
  IF p_perfil <> 'admin' THEN
    FOREACH v_obra IN ARRAY COALESCE(p_obras, ARRAY[]::uuid[]) LOOP
      INSERT INTO obra_usuarios(cliente_id, usuario_id, obra_id, papel, ativo)
      VALUES (v_cliente, v_id, v_obra, p_perfil::text, true);
    END LOOP;
  END IF;
  RETURN v_id;
END
$function$;

-- PowerSync: coluna obra_id derivada nas tabelas "profundas".
--
-- Por quê: no PowerSync (Sync Streams), um filtro por subconsulta encadeada
-- (ex.: verificacao_itens.verificacao_id IN (SELECT v.id ... WHERE obra_id IN minhas_obras))
-- cria um bucket por registro pai (um por verificação, um por FVS...), não um por obra.
-- Um admin com 5 obras já passou do limite de 1000 resultados de parâmetro (PSYNC_S2305).
-- Com obra_id na própria linha, cada stream filtra `obra_id IN minhas_obras` e o bucket é por obra.
--
-- A coluna é DERIVADA do pai e mantida só por trigger: o valor enviado pelo cliente é ignorado.
-- Não há FK para obras (o apagamento já desce pela cadeia de FKs existente).
-- Limite conhecido: se um ambiente mudar de obra, os descendentes não são recalculados
-- (o app não faz isso hoje). Ver powersync/sync-config.yaml.


-- 1) Colunas -------------------------------------------------------------------------------
ALTER TABLE public.fvs_planejadas                     ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_conclusoes                     ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_reaberturas                    ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_medicao_configuracoes          ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.vinculos_execucao_servico          ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.verificacoes                       ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_medicao_etapas                 ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.avancos_aprovados_servico          ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.verificacao_itens                  ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.verificacao_fotos                  ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.nao_conformidades                  ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.nc_fotos                           ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.nc_reinspecoes                     ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.avaliacao_empreiteiro_itens        ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.avaliacao_empreiteiro_reaberturas  ADD COLUMN IF NOT EXISTS obra_id uuid;

-- 2) Trigger que deriva obra_id do pai -----------------------------------------------------
-- SECURITY DEFINER: a busca no pai não pode depender da RLS de quem grava.
-- Os campos de NEW são resolvidos em tempo de execução, então cada ramo só toca
-- colunas que existem na tabela daquele ramo.
CREATE OR REPLACE FUNCTION public.set_obra_id_derivado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'fvs_planejadas' THEN
      SELECT a.obra_id INTO NEW.obra_id FROM ambientes a WHERE a.id = NEW.ambiente_id;
    WHEN 'fvs_conclusoes', 'fvs_reaberturas', 'fvs_medicao_configuracoes',
         'vinculos_execucao_servico', 'verificacoes' THEN
      SELECT fp.obra_id INTO NEW.obra_id FROM fvs_planejadas fp WHERE fp.id = NEW.fvs_planejada_id;
    WHEN 'fvs_medicao_etapas' THEN
      SELECT c.obra_id INTO NEW.obra_id FROM fvs_medicao_configuracoes c WHERE c.id = NEW.configuracao_id;
    WHEN 'avancos_aprovados_servico' THEN
      SELECT v.obra_id INTO NEW.obra_id FROM vinculos_execucao_servico v WHERE v.id = NEW.vinculacao_id;
    WHEN 'verificacao_itens', 'verificacao_fotos', 'nao_conformidades' THEN
      SELECT v.obra_id INTO NEW.obra_id FROM verificacoes v WHERE v.id = NEW.verificacao_id;
    WHEN 'nc_fotos', 'nc_reinspecoes' THEN
      SELECT nc.obra_id INTO NEW.obra_id FROM nao_conformidades nc WHERE nc.id = NEW.nc_id;
    WHEN 'avaliacao_empreiteiro_itens', 'avaliacao_empreiteiro_reaberturas' THEN
      SELECT a.obra_id INTO NEW.obra_id FROM avaliacoes_empreiteiro a WHERE a.id = NEW.avaliacao_id;
  END CASE;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.set_obra_id_derivado() FROM PUBLIC;

-- `trg_00_` para rodar antes dos outros BEFORE (a ordem é alfabética).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fvs_planejadas', 'fvs_conclusoes', 'fvs_reaberturas', 'fvs_medicao_configuracoes',
    'vinculos_execucao_servico', 'verificacoes', 'fvs_medicao_etapas', 'avancos_aprovados_servico',
    'verificacao_itens', 'verificacao_fotos', 'nao_conformidades', 'nc_fotos', 'nc_reinspecoes',
    'avaliacao_empreiteiro_itens', 'avaliacao_empreiteiro_reaberturas'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_00_obra_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_00_obra_id BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_derivado()', t);
  END LOOP;
END
$$;

-- 3) Preenchimento das linhas existentes ---------------------------------------------------
-- Com os triggers de usuário desligados por tabela: o UPDATE não pode recalcular progresso,
-- gerar auditoria, mexer em updated_at nem esbarrar na imutabilidade dos avanços aprovados.
-- (O Neon não permite session_replication_role.) Ordem: pais antes dos filhos.
CREATE OR REPLACE FUNCTION pg_temp.preencher(p_tabela text, p_sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', p_tabela);
  EXECUTE p_sql;
  EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', p_tabela);
END
$$;

SELECT pg_temp.preencher('fvs_planejadas',
  'UPDATE fvs_planejadas t SET obra_id = a.obra_id FROM ambientes a WHERE a.id = t.ambiente_id AND t.obra_id IS DISTINCT FROM a.obra_id');
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = fp.obra_id FROM fvs_planejadas fp WHERE fp.id = t.fvs_planejada_id AND t.obra_id IS DISTINCT FROM fp.obra_id', tb))
FROM unnest(ARRAY['fvs_conclusoes', 'fvs_reaberturas', 'fvs_medicao_configuracoes',
                  'vinculos_execucao_servico', 'verificacoes']) AS tb;
SELECT pg_temp.preencher('fvs_medicao_etapas',
  'UPDATE fvs_medicao_etapas t SET obra_id = c.obra_id FROM fvs_medicao_configuracoes c WHERE c.id = t.configuracao_id AND t.obra_id IS DISTINCT FROM c.obra_id');
SELECT pg_temp.preencher('avancos_aprovados_servico',
  'UPDATE avancos_aprovados_servico t SET obra_id = v.obra_id FROM vinculos_execucao_servico v WHERE v.id = t.vinculacao_id AND t.obra_id IS DISTINCT FROM v.obra_id');
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = v.obra_id FROM verificacoes v WHERE v.id = t.verificacao_id AND t.obra_id IS DISTINCT FROM v.obra_id', tb))
FROM unnest(ARRAY['verificacao_itens', 'verificacao_fotos', 'nao_conformidades']) AS tb;
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = nc.obra_id FROM nao_conformidades nc WHERE nc.id = t.nc_id AND t.obra_id IS DISTINCT FROM nc.obra_id', tb))
FROM unnest(ARRAY['nc_fotos', 'nc_reinspecoes']) AS tb;
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = a.obra_id FROM avaliacoes_empreiteiro a WHERE a.id = t.avaliacao_id AND t.obra_id IS DISTINCT FROM a.obra_id', tb))
FROM unnest(ARRAY['avaliacao_empreiteiro_itens', 'avaliacao_empreiteiro_reaberturas']) AS tb;

-- 4) Índices (consultas do painel por obra e a própria checagem de consistência) ----------
CREATE INDEX IF NOT EXISTS idx_fvs_planejadas_obra_id            ON public.fvs_planejadas (obra_id);
CREATE INDEX IF NOT EXISTS idx_verificacoes_obra_id              ON public.verificacoes (obra_id);
CREATE INDEX IF NOT EXISTS idx_verificacao_itens_obra_id         ON public.verificacao_itens (obra_id);
CREATE INDEX IF NOT EXISTS idx_nao_conformidades_obra_id         ON public.nao_conformidades (obra_id);


-- Contratos de empreiteiro (obra + empreiteiro + serviços). Idempotente.
-- Cada serviço medido (vinculos_execucao_servico) e cada medição (medicoes_servico) pertence a um contrato.
-- As RPCs antigas continuam iguais: um gatilho preenche o contrato a partir de `app.contrato_id` (setado pelas
-- RPCs *_contrato) ou do único contrato ativo daquele empreiteiro na obra, e recusa contrato de outra obra/empreiteiro.
-- Escrita só pelas RPCs (SECURITY DEFINER); leitura pela RLS de obra.

-- As funções de medição chamam uuid_generate_v4() sem schema (search_path public). A produção tem este
-- atalho em public; o prumoq-teste recriado não tinha. Mesma definição da produção.
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE sql
 PARALLEL SAFE
 SET search_path TO 'extensions', 'pg_temp'
AS $function$
  SELECT extensions.uuid_generate_v4()
$function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'status_contrato') THEN
    CREATE TYPE public.status_contrato AS ENUM ('ativo', 'encerrado');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  obra_id uuid NOT NULL,
  equipe_id uuid NOT NULL,
  numero text NOT NULL,
  objeto text NOT NULL,
  valor_contratado numeric(18,2),
  data_inicio date NOT NULL DEFAULT current_date,
  data_fim date,
  status public.status_contrato NOT NULL DEFAULT 'ativo',
  observacao text,
  criado_por uuid REFERENCES public.usuarios(id),
  encerrado_em timestamp with time zone,
  encerrado_por uuid REFERENCES public.usuarios(id),
  motivo_encerramento text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.usuarios(id),
  CONSTRAINT contratos_obra_id_cliente_fkey FOREIGN KEY (obra_id, cliente_id) REFERENCES public.obras(id, cliente_id),
  CONSTRAINT contratos_equipe_id_cliente_fkey FOREIGN KEY (equipe_id, cliente_id) REFERENCES public.equipes(id, cliente_id),
  CONSTRAINT contratos_numero_check CHECK (length(trim(numero)) > 0),
  CONSTRAINT contratos_objeto_check CHECK (length(trim(objeto)) > 0),
  CONSTRAINT contratos_valor_check CHECK (valor_contratado IS NULL OR valor_contratado >= 0),
  CONSTRAINT contratos_vigencia_check CHECK (data_fim IS NULL OR data_fim >= data_inicio),
  CONSTRAINT contratos_encerramento_check CHECK ((status = 'encerrado') = (encerrado_em IS NOT NULL))
);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.usuarios(id);
CREATE UNIQUE INDEX IF NOT EXISTS contratos_obra_numero_uidx ON public.contratos (obra_id, lower(numero));
CREATE INDEX IF NOT EXISTS contratos_cliente_status_idx ON public.contratos (cliente_id, status);
CREATE INDEX IF NOT EXISTS contratos_obra_equipe_idx ON public.contratos (obra_id, equipe_id);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contratos_read ON public.contratos;
CREATE POLICY contratos_read ON public.contratos AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
REVOKE ALL ON public.contratos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.contratos FROM authenticated;
GRANT SELECT ON public.contratos TO authenticated;

ALTER TABLE public.vinculos_execucao_servico ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id);
ALTER TABLE public.medicoes_servico ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id);
CREATE INDEX IF NOT EXISTS vinculos_execucao_contrato_idx ON public.vinculos_execucao_servico (contrato_id);
CREATE INDEX IF NOT EXISTS medicoes_servico_contrato_idx ON public.medicoes_servico (contrato_id, data_medicao DESC);

-- Preenche e confere o contrato de um vínculo ou de uma medição.
CREATE OR REPLACE FUNCTION public.atribuir_contrato_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_obra uuid;
  v_ctx uuid := NULLIF(current_setting('app.contrato_id', true), '')::uuid;
  v_n integer;
  v_id uuid;
  c public.contratos%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.contrato_id IS NOT DISTINCT FROM OLD.contrato_id
     AND NEW.equipe_id IS NOT DISTINCT FROM OLD.equipe_id THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'vinculos_execucao_servico' THEN
    v_obra := public.fvs_medicao_obra(NEW.fvs_planejada_id);
  ELSE
    v_obra := NEW.obra_id;
  END IF;
  IF NEW.contrato_id IS NULL AND v_ctx IS NOT NULL THEN
    NEW.contrato_id := v_ctx;
  END IF;
  IF NEW.contrato_id IS NULL THEN
    SELECT count(*), min(id::text)::uuid INTO v_n, v_id FROM public.contratos
      WHERE obra_id = v_obra AND equipe_id = NEW.equipe_id AND status = 'ativo';
    IF v_n = 1 THEN NEW.contrato_id := v_id; END IF;
  END IF;
  IF NEW.contrato_id IS NULL THEN
    RAISE EXCEPTION 'Escolha o contrato deste empreiteiro na obra' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO c FROM public.contratos WHERE id = NEW.contrato_id;
  IF NOT FOUND OR c.obra_id <> v_obra OR c.equipe_id <> NEW.equipe_id THEN
    RAISE EXCEPTION 'O contrato não é deste empreiteiro nesta obra' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' AND c.status <> 'ativo' THEN
    RAISE EXCEPTION 'Contrato encerrado não recebe serviços nem medições' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

-- Item de medição só com serviço do mesmo contrato da medição.
CREATE OR REPLACE FUNCTION public.validar_contrato_item_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (SELECT contrato_id FROM public.vinculos_execucao_servico WHERE id = NEW.vinculacao_id)
     IS DISTINCT FROM (SELECT contrato_id FROM public.medicoes_servico WHERE id = NEW.medicao_id) THEN
    RAISE EXCEPTION 'O serviço pertence a outro contrato' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

-- Contratos para o que já existe: um por par obra + empreiteiro com serviço ou medição.
DO $$
DECLARE r record;
BEGIN
  PERFORM set_config('app.measurement_controlled_write', '1', true);
  INSERT INTO public.contratos (cliente_id, obra_id, equipe_id, numero, objeto, data_inicio)
  SELECT p.cliente_id, p.obra_id, p.equipe_id,
    'CT-' || lpad((row_number() OVER (PARTITION BY p.obra_id ORDER BY e.nome, p.equipe_id))::text, 3, '0'),
    'Serviços de ' || e.nome, p.inicio
  FROM (
    SELECT cliente_id, obra_id, equipe_id, min(inicio) AS inicio FROM (
      SELECT v.cliente_id, public.fvs_medicao_obra(v.fvs_planejada_id) AS obra_id, v.equipe_id, v.data_inicio AS inicio
        FROM public.vinculos_execucao_servico v WHERE v.contrato_id IS NULL
      UNION ALL
      SELECT m.cliente_id, m.obra_id, m.equipe_id, m.periodo_inicio FROM public.medicoes_servico m WHERE m.contrato_id IS NULL
    ) x GROUP BY cliente_id, obra_id, equipe_id
  ) p
  JOIN public.equipes e ON e.id = p.equipe_id
  WHERE NOT EXISTS (SELECT 1 FROM public.contratos c WHERE c.obra_id = p.obra_id AND c.equipe_id = p.equipe_id);

  UPDATE public.vinculos_execucao_servico v SET contrato_id = c.id
    FROM public.contratos c
    WHERE v.contrato_id IS NULL AND c.obra_id = public.fvs_medicao_obra(v.fvs_planejada_id) AND c.equipe_id = v.equipe_id
      AND c.id = (SELECT min(c2.id::text)::uuid FROM public.contratos c2 WHERE c2.obra_id = c.obra_id AND c2.equipe_id = c.equipe_id);
  UPDATE public.medicoes_servico m SET contrato_id = c.id
    FROM public.contratos c
    WHERE m.contrato_id IS NULL AND c.obra_id = m.obra_id AND c.equipe_id = m.equipe_id
      AND c.id = (SELECT min(c2.id::text)::uuid FROM public.contratos c2 WHERE c2.obra_id = c.obra_id AND c2.equipe_id = c.equipe_id);
  PERFORM set_config('app.measurement_controlled_write', '', true);
END
$$;

-- Gatilhos depois da migração (o guarda de cliente exige um usuário logado).
DROP TRIGGER IF EXISTS trg_contratos_cliente_guard ON public.contratos;
CREATE TRIGGER trg_contratos_cliente_guard BEFORE INSERT OR UPDATE OF cliente_id ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cliente_id();
DROP TRIGGER IF EXISTS trg_contrato_atribuir ON public.vinculos_execucao_servico;
CREATE TRIGGER trg_contrato_atribuir BEFORE INSERT OR UPDATE ON public.vinculos_execucao_servico
  FOR EACH ROW EXECUTE FUNCTION atribuir_contrato_medicao();
DROP TRIGGER IF EXISTS trg_contrato_atribuir ON public.medicoes_servico;
CREATE TRIGGER trg_contrato_atribuir BEFORE INSERT OR UPDATE ON public.medicoes_servico
  FOR EACH ROW EXECUTE FUNCTION atribuir_contrato_medicao();
DROP TRIGGER IF EXISTS trg_contrato_item ON public.medicao_servico_itens;
CREATE TRIGGER trg_contrato_item BEFORE INSERT ON public.medicao_servico_itens
  FOR EACH ROW EXECUTE FUNCTION validar_contrato_item_medicao();

-- A referência (BM 01...) passa a ser única por contrato.
DROP INDEX IF EXISTS public.medicoes_obra_equipe_referencia_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS medicoes_contrato_referencia_uidx ON public.medicoes_servico (contrato_id, lower(referencia));

CREATE OR REPLACE FUNCTION public.salvar_contrato(
  p_contrato_id uuid, p_obra_id uuid, p_equipe_id uuid, p_numero text, p_objeto text,
  p_valor_contratado numeric, p_data_inicio date, p_data_fim date, p_observacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid := p_contrato_id;
  v_cliente uuid;
  c public.contratos%ROWTYPE;
  v_actor uuid := public.current_usuario_id();
BEGIN
  IF NOT public.measurement_actor_can_manage(p_obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar contratos desta obra' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT cliente_id INTO v_cliente FROM public.obras WHERE id = p_obra_id AND controle_medicoes_efetivo;
  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.obra_equipes WHERE obra_id = p_obra_id AND equipe_id = p_equipe_id) THEN
    RAISE EXCEPTION 'O empreiteiro não está vinculado a esta obra' USING ERRCODE = 'check_violation';
  END IF;
  IF NULLIF(trim(p_numero), '') IS NULL OR NULLIF(trim(p_objeto), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o número e o objeto do contrato' USING ERRCODE = 'check_violation';
  END IF;
  IF p_data_inicio IS NULL OR (p_data_fim IS NOT NULL AND p_data_fim < p_data_inicio) THEN
    RAISE EXCEPTION 'Datas do contrato inválidas' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contratos WHERE obra_id = p_obra_id AND lower(numero) = lower(trim(p_numero))
             AND id IS DISTINCT FROM p_contrato_id) THEN
    RAISE EXCEPTION 'Já existe um contrato com este número nesta obra' USING ERRCODE = 'unique_violation';
  END IF;

  IF p_contrato_id IS NULL THEN
    INSERT INTO public.contratos (cliente_id, obra_id, equipe_id, numero, objeto, valor_contratado, data_inicio, data_fim, observacao, criado_por, updated_by)
    VALUES (v_cliente, p_obra_id, p_equipe_id, trim(p_numero), trim(p_objeto), p_valor_contratado, p_data_inicio, p_data_fim,
            NULLIF(trim(p_observacao), ''), v_actor, v_actor)
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id FOR UPDATE;
    IF NOT FOUND OR c.obra_id <> p_obra_id THEN
      RAISE EXCEPTION 'Contrato não encontrado' USING ERRCODE = 'check_violation';
    END IF;
    IF c.equipe_id <> p_equipe_id AND (
         EXISTS (SELECT 1 FROM public.vinculos_execucao_servico WHERE contrato_id = c.id)
      OR EXISTS (SELECT 1 FROM public.medicoes_servico WHERE contrato_id = c.id)) THEN
      RAISE EXCEPTION 'O empreiteiro não pode mudar depois que o contrato tem serviços ou medições' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.contratos SET equipe_id = p_equipe_id, numero = trim(p_numero), objeto = trim(p_objeto),
      valor_contratado = p_valor_contratado, data_inicio = p_data_inicio, data_fim = p_data_fim,
      observacao = NULLIF(trim(p_observacao), ''), updated_at = now(), updated_by = v_actor
    WHERE id = c.id;
  END IF;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (v_cliente, p_obra_id, 'contrato', v_id, CASE WHEN p_contrato_id IS NULL THEN 'criado' ELSE 'atualizado' END,
          jsonb_build_object('numero', trim(p_numero), 'equipe', p_equipe_id, 'valor', p_valor_contratado), v_actor);
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.encerrar_contrato(p_contrato_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.contratos%ROWTYPE;
  v_actor uuid := public.current_usuario_id();
BEGIN
  SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(c.obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar este contrato' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'ativo' THEN
    RAISE EXCEPTION 'O contrato já está encerrado' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.medicoes_servico WHERE contrato_id = c.id AND status = 'rascunho') THEN
    RAISE EXCEPTION 'Aprove ou descarte os rascunhos de medição antes de encerrar' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.contratos SET status = 'encerrado', encerrado_em = now(), encerrado_por = v_actor,
    motivo_encerramento = NULLIF(trim(p_motivo), ''), updated_at = now(), updated_by = v_actor
  WHERE id = c.id;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (c.cliente_id, c.obra_id, 'contrato', c.id, 'encerrado', jsonb_build_object('motivo', p_motivo), v_actor);
END
$function$;

CREATE OR REPLACE FUNCTION public.reabrir_contrato(p_contrato_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.contratos%ROWTYPE;
  v_actor uuid := public.current_usuario_id();
BEGIN
  SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(c.obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para reabrir este contrato' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.contratos SET status = 'ativo', encerrado_em = NULL, encerrado_por = NULL, motivo_encerramento = NULL,
    updated_at = now(), updated_by = v_actor
  WHERE id = c.id;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, usuario_id)
  VALUES (c.cliente_id, c.obra_id, 'contrato', c.id, 'reaberto', v_actor);
END
$function$;

-- Contrato ativo que a pessoa pode gerenciar (usado pelas RPCs abaixo).
CREATE OR REPLACE FUNCTION public.contrato_gerenciavel(p_contrato_id uuid)
 RETURNS public.contratos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(c.obra_id) THEN
    RAISE EXCEPTION 'Sem permissão neste contrato' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'ativo' THEN
    RAISE EXCEPTION 'Contrato encerrado' USING ERRCODE = 'check_violation';
  END IF;
  RETURN c;
END
$function$;

CREATE OR REPLACE FUNCTION public.salvar_configuracao_medicao_contrato(
  p_contrato_id uuid, p_fvs_id uuid, p_metodo metodo_medicao_servico, p_unidade text, p_quantidade_total numeric,
  p_preco_unitario numeric, p_permite_parciais boolean, p_modelo_id uuid, p_etapas jsonb, p_data_inicio date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_id); v_id uuid;
BEGIN
  IF public.fvs_medicao_obra(p_fvs_id) IS DISTINCT FROM c.obra_id THEN
    RAISE EXCEPTION 'O serviço não é da obra do contrato' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.contrato_id', c.id::text, true);
  v_id := public.salvar_configuracao_medicao_fvs(p_fvs_id, p_metodo, p_unidade, p_quantidade_total, p_preco_unitario,
    p_permite_parciais, p_modelo_id, p_etapas, c.equipe_id, COALESCE(p_data_inicio, current_date));
  PERFORM set_config('app.contrato_id', '', true);
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.salvar_medicao_contrato(
  p_contrato_id uuid, p_medicao_id uuid, p_referencia text, p_periodo_inicio date, p_periodo_fim date,
  p_data_medicao date, p_observacao text, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_id); v_id uuid;
BEGIN
  IF p_medicao_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.medicoes_servico WHERE id = p_medicao_id AND contrato_id = c.id) THEN
    RAISE EXCEPTION 'A medição não é deste contrato' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.contrato_id', c.id::text, true);
  v_id := public.salvar_medicao_rascunho(p_medicao_id, c.obra_id, c.equipe_id, p_referencia, p_periodo_inicio,
    p_periodo_fim, p_data_medicao, p_observacao, p_itens);
  PERFORM set_config('app.contrato_id', '', true);
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.trocar_empreiteiro_contrato(
  p_vinculo_id uuid, p_contrato_destino_id uuid, p_data date, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_destino_id); v_id uuid;
BEGIN
  IF (SELECT public.fvs_medicao_obra(fvs_planejada_id) FROM public.vinculos_execucao_servico WHERE id = p_vinculo_id)
     IS DISTINCT FROM c.obra_id THEN
    RAISE EXCEPTION 'O contrato de destino é de outra obra' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.contrato_id', c.id::text, true);
  v_id := public.trocar_empreiteiro_servico(p_vinculo_id, c.equipe_id, p_data, p_motivo);
  PERFORM set_config('app.contrato_id', '', true);
  RETURN v_id;
END
$function$;

-- Resumo financeiro por contrato (RLS de quem consulta).
CREATE OR REPLACE VIEW public.vw_resumo_contratos WITH (security_invoker = true) AS
WITH servicos AS (
  SELECT v.contrato_id,
    count(DISTINCT v.fvs_planejada_id) AS servicos,
    sum(CASE WHEN v.status = 'ativo' THEN v.escopo_atribuido ELSE v.aprovado_congelado END
        * COALESCE(cfg.preco_unitario, 0))::numeric(18,2) AS valor_previsto
  FROM public.vinculos_execucao_servico v
  JOIN public.fvs_medicao_configuracoes cfg ON cfg.fvs_planejada_id = v.fvs_planejada_id
  WHERE v.contrato_id IS NOT NULL
  GROUP BY v.contrato_id
), saldos AS (
  SELECT v.contrato_id,
    sum(s.valor_disponivel)::numeric(18,2) AS valor_liberado,
    sum(s.valor_bloqueado)::numeric(18,2) AS valor_bloqueado
  FROM public.vw_saldos_medicao_servico s
  JOIN public.vinculos_execucao_servico v ON v.id = s.vinculacao_id
  WHERE v.contrato_id IS NOT NULL
  GROUP BY v.contrato_id
), medicoes AS (
  SELECT m.contrato_id,
    count(*) FILTER (WHERE m.status = 'aprovada') AS medicoes_aprovadas,
    count(*) FILTER (WHERE m.status = 'rascunho') AS rascunhos,
    max(m.data_medicao) FILTER (WHERE m.status = 'aprovada') AS ultima_medicao,
    COALESCE(sum(t.valor) FILTER (WHERE m.status = 'aprovada'), 0)::numeric(18,2) AS valor_medido,
    COALESCE(sum(t.valor) FILTER (WHERE m.status = 'rascunho'), 0)::numeric(18,2) AS valor_rascunho
  FROM public.medicoes_servico m
  LEFT JOIN LATERAL (SELECT sum(i.valor_calculado) AS valor FROM public.medicao_servico_itens i WHERE i.medicao_id = m.id) t ON true
  WHERE m.contrato_id IS NOT NULL
  GROUP BY m.contrato_id
)
SELECT c.id AS contrato_id, c.cliente_id, c.obra_id, c.equipe_id,
  COALESCE(s.servicos, 0)::integer AS servicos,
  COALESCE(s.valor_previsto, 0)::numeric(18,2) AS valor_previsto,
  COALESCE(c.valor_contratado, s.valor_previsto, 0)::numeric(18,2) AS valor_referencia,
  COALESCE(m.valor_medido, 0)::numeric(18,2) AS valor_medido,
  COALESCE(m.valor_rascunho, 0)::numeric(18,2) AS valor_rascunho,
  greatest(COALESCE(c.valor_contratado, s.valor_previsto, 0) - COALESCE(m.valor_medido, 0), 0)::numeric(18,2) AS valor_a_medir,
  COALESCE(sa.valor_liberado, 0)::numeric(18,2) AS valor_liberado,
  COALESCE(sa.valor_bloqueado, 0)::numeric(18,2) AS valor_bloqueado,
  COALESCE(m.medicoes_aprovadas, 0)::integer AS medicoes_aprovadas,
  COALESCE(m.rascunhos, 0)::integer AS rascunhos,
  m.ultima_medicao
FROM public.contratos c
LEFT JOIN servicos s ON s.contrato_id = c.id
LEFT JOIN saldos sa ON sa.contrato_id = c.id
LEFT JOIN medicoes m ON m.contrato_id = c.id;
REVOKE ALL ON public.vw_resumo_contratos FROM anon;
GRANT SELECT ON public.vw_resumo_contratos TO authenticated;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('salvar_contrato', 'encerrar_contrato', 'reabrir_contrato',
             'salvar_configuracao_medicao_contrato', 'salvar_medicao_contrato', 'trocar_empreiteiro_contrato') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('atribuir_contrato_medicao', 'validar_contrato_item_medicao',
             'contrato_gerenciavel') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Aditivos de contrato: incluir serviços e mudar quantidade ou preço dos itens, com registro de quem fez. Idempotente.
-- O aditivo vale na hora. Medições já aprovadas não mudam (os itens guardam preço e valor do momento da medição).
-- O valor do contrato muda pela diferença dos itens: Σ(qtd nova × preço novo − qtd antiga × preço antigo).

CREATE TABLE IF NOT EXISTS public.contrato_aditivos (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id),
  numero integer NOT NULL,
  descricao text NOT NULL,
  data date NOT NULL DEFAULT current_date,
  valor_anterior numeric(18,2) NOT NULL,
  valor_novo numeric(18,2) NOT NULL,
  criado_por uuid REFERENCES public.usuarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contrato_aditivos_numero_check CHECK (numero > 0),
  CONSTRAINT contrato_aditivos_descricao_check CHECK (length(trim(descricao)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS contrato_aditivos_numero_uidx ON public.contrato_aditivos (contrato_id, numero);

CREATE TABLE IF NOT EXISTS public.contrato_aditivo_itens (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  aditivo_id uuid NOT NULL REFERENCES public.contrato_aditivos(id),
  fvs_planejada_id uuid NOT NULL REFERENCES public.fvs_planejadas(id),
  tipo text NOT NULL,
  unidade text NOT NULL,
  quantidade_anterior numeric(18,6) NOT NULL,
  quantidade_nova numeric(18,6) NOT NULL,
  preco_anterior numeric(18,4),
  preco_novo numeric(18,4),
  CONSTRAINT contrato_aditivo_itens_tipo_check CHECK (tipo IN ('inclusao', 'alteracao'))
);
CREATE INDEX IF NOT EXISTS contrato_aditivo_itens_aditivo_idx ON public.contrato_aditivo_itens (aditivo_id);

ALTER TABLE public.contrato_aditivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_aditivo_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contrato_aditivos_read ON public.contrato_aditivos;
CREATE POLICY contrato_aditivos_read ON public.contrato_aditivos AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
DROP POLICY IF EXISTS contrato_aditivo_itens_read ON public.contrato_aditivo_itens;
CREATE POLICY contrato_aditivo_itens_read ON public.contrato_aditivo_itens AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
REVOKE ALL ON public.contrato_aditivos, public.contrato_aditivo_itens FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.contrato_aditivos, public.contrato_aditivo_itens FROM authenticated;
GRANT SELECT ON public.contrato_aditivos, public.contrato_aditivo_itens TO authenticated;
DROP TRIGGER IF EXISTS trg_contrato_aditivos_cliente_guard ON public.contrato_aditivos;
CREATE TRIGGER trg_contrato_aditivos_cliente_guard BEFORE INSERT OR UPDATE OF cliente_id ON public.contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cliente_id();
DROP TRIGGER IF EXISTS trg_contrato_aditivo_itens_cliente_guard ON public.contrato_aditivo_itens;
CREATE TRIGGER trg_contrato_aditivo_itens_cliente_guard BEFORE INSERT OR UPDATE OF cliente_id ON public.contrato_aditivo_itens
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cliente_id();

CREATE OR REPLACE FUNCTION public.aplicar_aditivo_contrato(p_contrato_id uuid, p_descricao text, p_data date, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_id);
  v_actor uuid := public.current_usuario_id();
  v_id uuid := public.uuid_generate_v4();
  v_data date := COALESCE(p_data, current_date);
  v_numero integer;
  v_item jsonb;
  v_fvs uuid;
  v_nome text;
  v_metodo public.metodo_medicao_servico;
  cfg public.fvs_medicao_configuracoes%ROWTYPE;
  v_link public.vinculos_execucao_servico%ROWTYPE;
  v_qa numeric; v_qn numeric; v_pa numeric; v_pn numeric; v_aprovado numeric;
  v_delta numeric := 0;
  v_anterior numeric;
  v_novo numeric;
  v_n integer := 0;
BEGIN
  IF NULLIF(trim(p_descricao), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do aditivo' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Inclua ao menos um item no aditivo' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.contratos WHERE id = c.id FOR UPDATE;
  SELECT COALESCE(max(numero), 0) + 1 INTO v_numero FROM public.contrato_aditivos WHERE contrato_id = c.id;
  SELECT COALESCE(c.valor_contratado, r.valor_previsto, 0) INTO v_anterior FROM public.vw_resumo_contratos r WHERE r.contrato_id = c.id;
  v_anterior := COALESCE(v_anterior, c.valor_contratado, 0);

  INSERT INTO public.contrato_aditivos (id, cliente_id, obra_id, contrato_id, numero, descricao, data, valor_anterior, valor_novo, criado_por)
  VALUES (v_id, c.cliente_id, c.obra_id, c.id, v_numero, trim(p_descricao), v_data, v_anterior, v_anterior, v_actor);
  PERFORM set_config('app.aditivo_id', v_id::text, true);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_fvs := (v_item->>'fvs_id')::uuid;
    SELECT subservico INTO v_nome FROM public.fvs_planejadas WHERE id = v_fvs;
    v_nome := COALESCE(v_nome, 'serviço');

    IF COALESCE((v_item->>'novo')::boolean, false) THEN
      -- Inclusão de serviço novo no contrato.
      v_metodo := COALESCE(v_item->>'metodo', 'quantidade')::public.metodo_medicao_servico;
      IF v_metodo NOT IN ('quantidade', 'unidade_concluida') THEN
        RAISE EXCEPTION 'No aditivo, inclua % por quantidade ou unidade concluída', v_nome USING ERRCODE = 'check_violation';
      END IF;
      IF EXISTS (SELECT 1 FROM public.fvs_medicao_configuracoes WHERE fvs_planejada_id = v_fvs) THEN
        RAISE EXCEPTION '% já tem medição configurada', v_nome USING ERRCODE = 'check_violation';
      END IF;
      v_qn := CASE WHEN v_metodo = 'unidade_concluida' THEN 1 ELSE NULLIF(v_item->>'quantidade', '')::numeric END;
      v_pn := NULLIF(v_item->>'preco', '')::numeric;
      IF v_qn IS NULL OR v_qn <= 0 OR COALESCE(v_pn, 0) < 0 THEN
        RAISE EXCEPTION 'Quantidade ou preço inválido em %', v_nome USING ERRCODE = 'check_violation';
      END IF;
      PERFORM public.salvar_configuracao_medicao_contrato(c.id, v_fvs, v_metodo,
        CASE WHEN v_metodo = 'unidade_concluida' THEN 'un' ELSE COALESCE(NULLIF(trim(v_item->>'unidade'), ''), 'un') END,
        v_qn, v_pn, v_metodo <> 'unidade_concluida', NULL, '[]'::jsonb, v_data);
      PERFORM set_config('app.aditivo_id', v_id::text, true);
      INSERT INTO public.contrato_aditivo_itens (cliente_id, obra_id, aditivo_id, fvs_planejada_id, tipo, unidade,
        quantidade_anterior, quantidade_nova, preco_anterior, preco_novo)
      VALUES (c.cliente_id, c.obra_id, v_id, v_fvs, 'inclusao',
        CASE WHEN v_metodo = 'unidade_concluida' THEN 'un' ELSE COALESCE(NULLIF(trim(v_item->>'unidade'), ''), 'un') END,
        0, v_qn, NULL, v_pn);
      v_delta := v_delta + v_qn * COALESCE(v_pn, 0);
      v_n := v_n + 1;
      CONTINUE;
    END IF;

    -- Alteração de item existente.
    SELECT * INTO cfg FROM public.fvs_medicao_configuracoes WHERE fvs_planejada_id = v_fvs FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.vinculos_execucao_servico WHERE fvs_planejada_id = v_fvs AND contrato_id = c.id) THEN
      RAISE EXCEPTION '% não faz parte deste contrato', v_nome USING ERRCODE = 'check_violation';
    END IF;
    SELECT COALESCE(sum(CASE WHEN status = 'ativo' THEN escopo_atribuido ELSE aprovado_congelado END), 0) INTO v_qa
      FROM public.vinculos_execucao_servico WHERE fvs_planejada_id = v_fvs AND contrato_id = c.id;
    v_pa := cfg.preco_unitario;
    v_qn := COALESCE(NULLIF(v_item->>'quantidade', '')::numeric, v_qa);
    v_pn := CASE WHEN v_item ? 'preco' THEN NULLIF(v_item->>'preco', '')::numeric ELSE v_pa END;
    IF v_pn IS NOT NULL AND v_pn < 0 THEN
      RAISE EXCEPTION 'Preço inválido em %', v_nome USING ERRCODE = 'check_violation';
    END IF;
    IF v_qn = v_qa AND v_pn IS NOT DISTINCT FROM v_pa THEN
      CONTINUE;
    END IF;

    IF v_qn <> v_qa THEN
      IF cfg.metodo <> 'quantidade' THEN
        RAISE EXCEPTION 'Em %, só o preço pode mudar (serviço medido por unidade ou etapas)', v_nome USING ERRCODE = 'check_violation';
      END IF;
      SELECT * INTO v_link FROM public.vinculos_execucao_servico
        WHERE fvs_planejada_id = v_fvs AND contrato_id = c.id AND status = 'ativo' FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION '% não tem responsável ativo neste contrato', v_nome USING ERRCODE = 'check_violation';
      END IF;
      SELECT COALESCE(max(aprovado_atual), 0) INTO v_aprovado FROM public.avancos_aprovados_servico WHERE vinculacao_id = v_link.id;
      IF v_link.escopo_atribuido + (v_qn - v_qa) <= 0 OR v_link.escopo_atribuido + (v_qn - v_qa) < v_aprovado THEN
        RAISE EXCEPTION 'A quantidade de % não pode ficar abaixo do já aprovado em campo (% %)',
          v_nome, trim(to_char(v_qa - v_link.escopo_atribuido + v_aprovado, 'FM999999999990.######')), cfg.unidade
          USING ERRCODE = 'check_violation';
      END IF;
      UPDATE public.vinculos_execucao_servico SET escopo_atribuido = escopo_atribuido + (v_qn - v_qa), updated_at = now()
        WHERE id = v_link.id;
      UPDATE public.fvs_medicao_configuracoes SET quantidade_total = quantidade_total + (v_qn - v_qa),
        updated_by = v_actor, updated_at = now() WHERE id = cfg.id;
    END IF;
    IF v_pn IS DISTINCT FROM v_pa THEN
      UPDATE public.fvs_medicao_configuracoes SET preco_unitario = v_pn, updated_by = v_actor, updated_at = now() WHERE id = cfg.id;
    END IF;
    INSERT INTO public.contrato_aditivo_itens (cliente_id, obra_id, aditivo_id, fvs_planejada_id, tipo, unidade,
      quantidade_anterior, quantidade_nova, preco_anterior, preco_novo)
    VALUES (c.cliente_id, c.obra_id, v_id, v_fvs, 'alteracao', cfg.unidade, v_qa, v_qn, v_pa, v_pn);
    v_delta := v_delta + v_qn * COALESCE(v_pn, 0) - v_qa * COALESCE(v_pa, 0);
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'Nenhum item mudou: altere quantidade ou preço, ou inclua um serviço' USING ERRCODE = 'check_violation';
  END IF;
  v_novo := round(v_anterior + v_delta, 2);
  UPDATE public.contrato_aditivos SET valor_novo = v_novo WHERE id = v_id;
  UPDATE public.contratos SET
    valor_contratado = CASE WHEN valor_contratado IS NULL THEN NULL ELSE v_novo END,
    updated_at = now(), updated_by = v_actor
  WHERE id = c.id;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (c.cliente_id, c.obra_id, 'contrato', c.id, 'aditivo',
    jsonb_build_object('aditivo', v_id, 'numero', v_numero, 'valor_anterior', v_anterior, 'valor_novo', v_novo, 'itens', v_n), v_actor);
  PERFORM set_config('app.aditivo_id', '', true);
  RETURN v_id;
END
$function$;

-- Quantidade ou preço mudados fora de um aditivo (ou da configuração pelo contrato) ficam registrados com o autor.
CREATE OR REPLACE FUNCTION public.registrar_alteracao_config_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (NEW.quantidade_total, NEW.preco_unitario) IS NOT DISTINCT FROM (OLD.quantidade_total, OLD.preco_unitario) THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.aditivo_id', true), '') <> '' OR COALESCE(current_setting('app.contrato_id', true), '') <> '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (NEW.cliente_id, public.fvs_medicao_obra(NEW.fvs_planejada_id), 'fvs_medicao_configuracao', NEW.id, 'alterada_fora_de_aditivo',
    jsonb_build_object('quantidade_anterior', OLD.quantidade_total, 'quantidade_nova', NEW.quantidade_total,
      'preco_anterior', OLD.preco_unitario, 'preco_novo', NEW.preco_unitario), public.current_usuario_id());
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_registrar_alteracao_config ON public.fvs_medicao_configuracoes;
CREATE TRIGGER trg_registrar_alteracao_config AFTER UPDATE ON public.fvs_medicao_configuracoes
  FOR EACH ROW EXECUTE FUNCTION registrar_alteracao_config_medicao();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'aplicar_aditivo_contrato' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'registrar_alteracao_config_medicao' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'excluir_obra' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'plataforma_criar_cliente' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'plataforma_atualizar_cliente' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'criar_usuario' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;

-- 6) Heartbeat diário
CREATE TABLE IF NOT EXISTS public.sistema_heartbeat (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ultimo_em timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.sistema_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sistema_heartbeat FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.registrar_heartbeat()
RETURNS timestamp with time zone
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.sistema_heartbeat (id, ultimo_em) VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET ultimo_em = excluded.ultimo_em
  RETURNING ultimo_em
$$;
REVOKE ALL ON FUNCTION public.registrar_heartbeat() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_heartbeat() TO anon, authenticated;


COMMIT;
