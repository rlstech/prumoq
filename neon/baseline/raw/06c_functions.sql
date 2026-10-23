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
    JOIN usuarios u ON u.id = auth.uid() AND u.cliente_id = o.cliente_id
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
  SET status='invalidada', invalidada_por=auth.uid(), invalidada_em=now(), motivo_invalidacao=trim(p_motivo), updated_at=now()
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
    WHERE u.id = auth.uid() AND u.ativo = true
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
  SELECT auth.uid() IS NOT NULL
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
  IF auth.uid() = OLD.id AND get_perfil() <> 'admin' THEN
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
  IF auth.uid() IS NULL OR public.get_perfil()<>'admin' OR v_cliente IS NULL THEN RAISE EXCEPTION 'Somente administradores podem publicar modelos' USING ERRCODE='insufficient_privilege'; END IF;
  IF nullif(trim(p_nome),'') IS NULL OR nullif(trim(p_descricao_alteracoes),'') IS NULL OR jsonb_typeof(p_criterios)<>'array' OR jsonb_array_length(p_criterios)=0 THEN RAISE EXCEPTION 'Nome, alterações e critérios são obrigatórios' USING ERRCODE='check_violation'; END IF;
  IF p_empresa_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.empresas e WHERE e.id=p_empresa_id AND e.cliente_id=v_cliente) THEN RAISE EXCEPTION 'Empresa fora do escopo' USING ERRCODE='insufficient_privilege'; END IF;
  INSERT INTO public.modelos_avaliacao_empreiteiro(id,cliente_id,empresa_id,nome,descricao,ativo,criado_por)
  VALUES(v_modelo,v_cliente,p_empresa_id,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),p_ativo,auth.uid())
  ON CONFLICT(id) DO UPDATE SET empresa_id=excluded.empresa_id,nome=excluded.nome,descricao=excluded.descricao,ativo=excluded.ativo,updated_at=now()
  WHERE public.modelos_avaliacao_empreiteiro.cliente_id=v_cliente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado' USING ERRCODE='no_data_found'; END IF;
  SELECT revisao_atual+1 INTO v_revisao FROM public.modelos_avaliacao_empreiteiro WHERE id=v_modelo FOR UPDATE;
  INSERT INTO public.modelo_avaliacao_empreiteiro_revisoes(cliente_id,modelo_id,numero_revisao,descricao_alteracoes,publicado_por)
  VALUES(v_cliente,v_modelo,v_revisao,trim(p_descricao_alteracoes),auth.uid()) RETURNING id INTO v_modelo;
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
    v_unidade, auth.uid(), p_created_offline
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
  VALUES(v_config_id,v_cliente_id,p_fvs_id,p_metodo,trim(p_unidade),p_quantidade_total,p_preco_unitario,p_permite_parciais,p_modelo_id,auth.uid(),auth.uid())
  ON CONFLICT(id) DO UPDATE SET metodo=EXCLUDED.metodo,unidade=EXCLUDED.unidade,quantidade_total=EXCLUDED.quantidade_total,
    preco_unitario=EXCLUDED.preco_unitario,permite_medicoes_parciais=EXCLUDED.permite_medicoes_parciais,
    modelo_origem_id=EXCLUDED.modelo_origem_id,updated_by=auth.uid(),updated_at=now();
  IF p_metodo='etapas_ponderadas' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_etapas) LOOP
      v_etapa_id:=uuid_generate_v4();
      INSERT INTO fvs_medicao_etapas(id,cliente_id,configuracao_id,ordem,nome,peso_percentual,permite_avanco_parcial,ativo,equipe_responsavel_id,updated_by)
      VALUES(v_etapa_id,v_cliente_id,v_config_id,(v_item->>'ordem')::integer,trim(v_item->>'nome'),(v_item->>'peso_percentual')::numeric,
        COALESCE((v_item->>'permite_avanco_parcial')::boolean,false),COALESCE((v_item->>'ativo')::boolean,true),p_equipe_inicial_id,auth.uid());
      IF COALESCE((v_item->>'ativo')::boolean,true) THEN
        INSERT INTO vinculos_execucao_servico(cliente_id,fvs_planejada_id,etapa_id,equipe_id,data_inicio,escopo_atribuido,criado_por)
        VALUES(v_cliente_id,p_fvs_id,v_etapa_id,p_equipe_inicial_id,COALESCE(p_data_inicio,current_date),(v_item->>'peso_percentual')::numeric,auth.uid());
      END IF;
    END LOOP;
  ELSE
    INSERT INTO vinculos_execucao_servico(cliente_id,fvs_planejada_id,equipe_id,data_inicio,escopo_atribuido,criado_por)
    VALUES(v_cliente_id,p_fvs_id,p_equipe_inicial_id,COALESCE(p_data_inicio,current_date),p_quantidade_total,auth.uid());
  END IF;
  INSERT INTO auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,dados,usuario_id)
  VALUES(v_cliente_id,v_obra_id,'fvs_medicao_configuracao',v_config_id,'configurada',jsonb_build_object('metodo',p_metodo,'total',p_quantidade_total),auth.uid());
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
$function$
;
