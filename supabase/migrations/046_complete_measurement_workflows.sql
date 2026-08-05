-- Completa os fluxos transacionais de medição e corrige projeções da primeira versão.

ALTER TABLE fvs_medicao_etapas
  ADD COLUMN IF NOT EXISTS status status_etapa_medicao NOT NULL DEFAULT 'nao_iniciada',
  ADD COLUMN IF NOT EXISTS percentual_interno numeric(7,4) CHECK (percentual_interno BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS equipe_responsavel_id uuid REFERENCES equipes(id),
  ADD COLUMN IF NOT EXISTS verificacao_evidencia_id uuid REFERENCES verificacoes(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE avancos_aprovados_servico
  ADD COLUMN IF NOT EXISTS created_offline boolean NOT NULL DEFAULT false;

ALTER TABLE nao_conformidades
  ADD COLUMN IF NOT EXISTS valor_bloqueado numeric(18,4) CHECK (valor_bloqueado IS NULL OR valor_bloqueado >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS medicoes_obra_equipe_referencia_uidx
  ON medicoes_servico(obra_id, equipe_id, lower(referencia));

CREATE OR REPLACE FUNCTION measurement_actor_can_manage(p_obra_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL
     AND get_perfil() IN ('admin', 'gestor')
     AND has_obra_access(p_obra_id)
$$;
REVOKE ALL ON FUNCTION measurement_actor_can_manage(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION salvar_modelo_etapas_medicao(
  p_modelo_id uuid,
  p_empresa_id uuid,
  p_nome text,
  p_ativo boolean,
  p_etapas jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
END $$;
REVOKE ALL ON FUNCTION salvar_modelo_etapas_medicao(uuid,uuid,text,boolean,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION salvar_modelo_etapas_medicao(uuid,uuid,text,boolean,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION salvar_configuracao_medicao_fvs(
  p_fvs_id uuid,
  p_metodo metodo_medicao_servico,
  p_unidade text,
  p_quantidade_total numeric,
  p_preco_unitario numeric,
  p_permite_parciais boolean,
  p_modelo_id uuid,
  p_etapas jsonb,
  p_equipe_inicial_id uuid,
  p_data_inicio date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
END $$;
REVOKE ALL ON FUNCTION salvar_configuracao_medicao_fvs(uuid,metodo_medicao_servico,text,numeric,numeric,boolean,uuid,jsonb,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION salvar_configuracao_medicao_fvs(uuid,metodo_medicao_servico,text,numeric,numeric,boolean,uuid,jsonb,uuid,date) TO authenticated;

CREATE OR REPLACE FUNCTION registrar_avanco_aprovado(
  p_id uuid, p_vinculo_id uuid, p_verificacao_id uuid,
  p_executado_atual numeric, p_aprovado_atual numeric, p_created_offline boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v vinculos_execucao_servico%ROWTYPE; v_prev record; v_unidade text; v_id uuid:=COALESCE(p_id,uuid_generate_v4());
BEGIN
  SELECT * INTO v FROM vinculos_execucao_servico WHERE id=p_vinculo_id FOR UPDATE;
  IF NOT FOUND OR get_perfil() NOT IN ('admin','gestor','inspetor') OR NOT has_fvs_access(v.fvs_planejada_id) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar avanço' USING ERRCODE='insufficient_privilege';
  END IF;
  IF v.status<>'ativo' THEN RAISE EXCEPTION 'O vínculo de execução não está ativo' USING ERRCODE='check_violation'; END IF;
  SELECT executado_atual,aprovado_atual INTO v_prev FROM avancos_aprovados_servico WHERE vinculacao_id=v.id ORDER BY data_aprovacao DESC,created_at DESC LIMIT 1;
  SELECT unidade INTO v_unidade FROM fvs_medicao_configuracoes WHERE fvs_planejada_id=v.fvs_planejada_id;
  INSERT INTO avancos_aprovados_servico(id,cliente_id,vinculacao_id,verificacao_id,etapa_id,executado_anterior,executado_atual,
    aprovado_anterior,aprovado_atual,unidade,aprovado_por,created_offline)
  VALUES(v_id,v.cliente_id,v.id,p_verificacao_id,v.etapa_id,COALESCE(v_prev.executado_atual,0),p_executado_atual,
    COALESCE(v_prev.aprovado_atual,0),p_aprovado_atual,v_unidade,auth.uid(),p_created_offline);
  IF v.etapa_id IS NOT NULL THEN
    UPDATE fvs_medicao_etapas SET
      status=CASE WHEN p_aprovado_atual>=v.escopo_atribuido THEN 'aprovada'::status_etapa_medicao
        WHEN p_executado_atual>=v.escopo_atribuido THEN 'concluida'::status_etapa_medicao
        WHEN p_executado_atual>0 THEN 'em_execucao'::status_etapa_medicao ELSE 'nao_iniciada'::status_etapa_medicao END,
      percentual_interno=least(100,(p_aprovado_atual/nullif(v.escopo_atribuido,0))*100),equipe_responsavel_id=v.equipe_id,
      verificacao_evidencia_id=p_verificacao_id,updated_by=auth.uid(),updated_at=now()
    WHERE id=v.etapa_id;
  END IF;
  INSERT INTO auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,dados,usuario_id)
  VALUES(v.cliente_id,fvs_medicao_obra(v.fvs_planejada_id),'avanco_aprovado',v_id,'aprovado',jsonb_build_object('executado',p_executado_atual,'aprovado',p_aprovado_atual),auth.uid());
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION registrar_avanco_aprovado(uuid,uuid,uuid,numeric,numeric,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_avanco_aprovado(uuid,uuid,uuid,numeric,numeric,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION saldo_vinculo_execucao(p_vinculo uuid)
RETURNS TABLE(aprovado numeric, medido numeric, bloqueado numeric, disponivel numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH scope AS (SELECT escopo_atribuido FROM vinculos_execucao_servico WHERE id=p_vinculo),
  a AS (SELECT COALESCE(max(aprovado_atual),0) v FROM avancos_aprovados_servico WHERE vinculacao_id=p_vinculo),
  m AS (SELECT COALESCE(sum(i.quantidade_periodo),0) v FROM medicao_servico_itens i JOIN medicoes_servico h ON h.id=i.medicao_id
        WHERE i.vinculacao_id=p_vinculo AND i.tipo='avanco' AND h.status='aprovada'),
  b AS (SELECT bool_or(n.bloqueio_medicao='total') total,
        COALESCE(sum(CASE WHEN n.bloqueio_medicao='parcial' THEN COALESCE(n.quantidade_bloqueada,(n.percentual_bloqueado/100)*scope.escopo_atribuido,0) ELSE 0 END),0) parcial
        FROM scope,nao_conformidades n JOIN verificacoes ver ON ver.id=n.verificacao_id
        JOIN avancos_aprovados_servico aa ON aa.verificacao_id=ver.id
        WHERE aa.vinculacao_id=p_vinculo AND n.status IN ('aberta','em_correcao'))
  SELECT a.v,m.v,CASE WHEN b.total THEN greatest(a.v-m.v,0) ELSE least(b.parcial,greatest(a.v-m.v,0)) END,
    CASE WHEN b.total THEN 0 ELSE greatest(0,a.v-m.v-b.parcial) END FROM a,m,b
$$;

CREATE OR REPLACE FUNCTION salvar_medicao_rascunho(
  p_medicao_id uuid, p_obra_id uuid, p_equipe_id uuid, p_referencia text,
  p_periodo_inicio date, p_periodo_fim date, p_data_medicao date, p_observacao text, p_itens jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid:=COALESCE(p_medicao_id,uuid_generate_v4()); v_cliente_id uuid; v_item jsonb; v_item_id uuid; v_release text; v_link vinculos_execucao_servico%ROWTYPE; v_sum numeric; v_price numeric;
BEGIN
  IF NOT measurement_actor_can_manage(p_obra_id) THEN RAISE EXCEPTION 'Sem permissão para salvar medição' USING ERRCODE='insufficient_privilege'; END IF;
  SELECT cliente_id INTO v_cliente_id FROM obras WHERE id=p_obra_id AND controle_medicoes_efetivo;
  IF v_cliente_id IS NULL OR p_periodo_fim<p_periodo_inicio OR NULLIF(trim(p_referencia),'') IS NULL THEN RAISE EXCEPTION 'Dados do boletim inválidos' USING ERRCODE='check_violation'; END IF;
  IF NOT EXISTS(SELECT 1 FROM obra_equipes WHERE obra_id=p_obra_id AND equipe_id=p_equipe_id) THEN RAISE EXCEPTION 'Equipe não vinculada à obra' USING ERRCODE='check_violation'; END IF;
  IF p_medicao_id IS NOT NULL THEN
    PERFORM 1 FROM medicoes_servico WHERE id=v_id AND status='rascunho' AND obra_id=p_obra_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Somente rascunhos podem ser editados' USING ERRCODE='check_violation'; END IF;
    DELETE FROM medicao_item_liberacoes WHERE medicao_item_id IN(SELECT id FROM medicao_servico_itens WHERE medicao_id=v_id);
    DELETE FROM medicao_servico_itens WHERE medicao_id=v_id;
    UPDATE medicoes_servico SET equipe_id=p_equipe_id,referencia=trim(p_referencia),periodo_inicio=p_periodo_inicio,periodo_fim=p_periodo_fim,
      data_medicao=COALESCE(p_data_medicao,current_date),observacao=p_observacao,updated_at=now() WHERE id=v_id;
  ELSE
    INSERT INTO medicoes_servico(id,cliente_id,obra_id,equipe_id,referencia,periodo_inicio,periodo_fim,data_medicao,observacao,criado_por)
    VALUES(v_id,v_cliente_id,p_obra_id,p_equipe_id,trim(p_referencia),p_periodo_inicio,p_periodo_fim,COALESCE(p_data_medicao,current_date),p_observacao,auth.uid());
  END IF;
  IF jsonb_typeof(p_itens)<>'array' OR jsonb_array_length(p_itens)=0 THEN RAISE EXCEPTION 'Inclua ao menos um item' USING ERRCODE='check_violation'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    SELECT * INTO v_link FROM vinculos_execucao_servico WHERE id=(v_item->>'vinculacao_id')::uuid FOR UPDATE;
    IF NOT FOUND OR fvs_medicao_obra(v_link.fvs_planejada_id)<>p_obra_id OR v_link.equipe_id<>p_equipe_id THEN RAISE EXCEPTION 'Vínculo fora do boletim' USING ERRCODE='check_violation'; END IF;
    v_item_id:=COALESCE((v_item->>'id')::uuid,uuid_generate_v4());
    SELECT preco_unitario INTO v_price FROM fvs_medicao_configuracoes WHERE fvs_planejada_id=v_link.fvs_planejada_id;
    IF COALESCE(v_item->>'tipo','avanco')='avanco' THEN
      SELECT COALESCE(sum(a.aprovado_atual-a.aprovado_anterior),0) INTO v_sum FROM avancos_aprovados_servico a
      WHERE a.id IN(SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'liberacao_ids','[]'::jsonb))) AND a.vinculacao_id=v_link.id;
      IF v_sum<=0 OR v_sum<>(v_item->>'quantidade_periodo')::numeric THEN RAISE EXCEPTION 'Selecione liberações completas e válidas' USING ERRCODE='check_violation'; END IF;
    ELSE v_sum:=COALESCE((v_item->>'quantidade_periodo')::numeric,0); END IF;
    INSERT INTO medicao_servico_itens(id,cliente_id,medicao_id,vinculacao_id,etapa_id,verificacao_id,nc_id,tipo,quantidade_anterior,quantidade_atual,
      quantidade_periodo,quantidade_bloqueada,unidade,preco_unitario,valor_calculado)
    VALUES(v_item_id,v_cliente_id,v_id,v_link.id,v_link.etapa_id,NULLIF(v_item->>'verificacao_id','')::uuid,NULLIF(v_item->>'nc_id','')::uuid,
      COALESCE(v_item->>'tipo','avanco')::tipo_item_medicao,COALESCE((v_item->>'quantidade_anterior')::numeric,0),COALESCE((v_item->>'quantidade_atual')::numeric,v_sum),
      v_sum,COALESCE((v_item->>'quantidade_bloqueada')::numeric,0),COALESCE(v_item->>'unidade','un'),COALESCE((v_item->>'preco_unitario')::numeric,v_price),
      COALESCE((v_item->>'valor_calculado')::numeric,v_sum*COALESCE(v_price,0)));
    IF COALESCE(v_item->>'tipo','avanco')='avanco' THEN
      FOR v_release IN SELECT value FROM jsonb_array_elements_text(v_item->'liberacao_ids') LOOP
        INSERT INTO medicao_item_liberacoes(cliente_id,medicao_item_id,avanco_id) VALUES(v_cliente_id,v_item_id,v_release::uuid);
      END LOOP;
    END IF;
  END LOOP;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION salvar_medicao_rascunho(uuid,uuid,uuid,text,date,date,date,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION salvar_medicao_rascunho(uuid,uuid,uuid,text,date,date,date,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION descartar_medicao_rascunho(p_medicao_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v medicoes_servico%ROWTYPE;
BEGIN
  SELECT * INTO v FROM medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR v.status<>'rascunho' OR NOT measurement_actor_can_manage(v.obra_id) THEN RAISE EXCEPTION 'Rascunho não pode ser descartado' USING ERRCODE='check_violation'; END IF;
  DELETE FROM medicao_item_liberacoes WHERE medicao_item_id IN(SELECT id FROM medicao_servico_itens WHERE medicao_id=v.id);
  DELETE FROM medicao_servico_itens WHERE medicao_id=v.id;
  DELETE FROM medicoes_servico WHERE id=v.id;
END $$;
REVOKE ALL ON FUNCTION descartar_medicao_rascunho(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION descartar_medicao_rascunho(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION protect_medicao_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_allowed boolean:=current_setting('app.measurement_controlled_write',true)='1';
BEGIN
  IF v_allowed THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='medicoes_servico' THEN
    IF TG_OP='DELETE' OR (OLD.status='aprovada' AND NEW.status<>'cancelada') OR OLD.status='cancelada' THEN RAISE EXCEPTION 'Medições aprovadas ou canceladas não podem ser alteradas diretamente' USING ERRCODE='check_violation'; END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM medicoes_servico h JOIN medicao_servico_itens i ON i.medicao_id=h.id
      WHERE i.id=CASE WHEN TG_TABLE_NAME='medicao_servico_itens' THEN COALESCE(NEW.id,OLD.id) ELSE COALESCE(NEW.medicao_item_id,OLD.medicao_item_id) END AND h.status<>'rascunho')
    THEN RAISE EXCEPTION 'Itens de medição aprovada ou cancelada são imutáveis' USING ERRCODE='check_violation'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION cancelar_medicao_servico(p_medicao_id uuid,p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
END $$;

CREATE OR REPLACE FUNCTION atualizar_impacto_financeiro_nc(
  p_nc_id uuid,p_situacao situacao_impacto_financeiro_nc,p_bloqueio bloqueio_medicao_nc,p_justificativa text,
  p_responsavel_avaliacao uuid,p_prazo date,p_valor_estimado numeric,p_valor_confirmado numeric,
  p_responsavel_financeiro responsavel_financeiro_nc,p_categoria categoria_impacto_financeiro_nc,
  p_quantidade_bloqueada numeric,p_percentual_bloqueado numeric,p_observacao text,p_documento text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n nao_conformidades%ROWTYPE; v_obra uuid; v_preco numeric; v_bloqueado numeric;
BEGIN
  SELECT * INTO n FROM nao_conformidades WHERE id=p_nc_id FOR UPDATE; v_obra:=nc_obra(p_nc_id);
  IF NOT FOUND OR NOT measurement_actor_can_manage(v_obra) OR NOT (SELECT controle_financeiro_nc_efetivo FROM obras WHERE id=v_obra) THEN RAISE EXCEPTION 'Sem permissão para alterar o impacto financeiro' USING ERRCODE='insufficient_privilege'; END IF;
  SELECT c.preco_unitario INTO v_preco FROM verificacoes ver JOIN fvs_medicao_configuracoes c ON c.fvs_planejada_id=ver.fvs_planejada_id WHERE ver.id=n.verificacao_id;
  v_bloqueado:=CASE WHEN p_bloqueio='parcial' THEN COALESCE(p_quantidade_bloqueada,0)*COALESCE(v_preco,0) ELSE NULL END;
  UPDATE nao_conformidades SET financeiro_requerido=true,situacao_financeira=p_situacao,bloqueio_medicao=p_bloqueio,
    justificativa_sem_impacto=CASE WHEN p_situacao='sem_impacto' THEN p_justificativa END,
    responsavel_avaliacao_id=CASE WHEN p_situacao='em_avaliacao' THEN p_responsavel_avaliacao END,
    prazo_avaliacao=CASE WHEN p_situacao='em_avaliacao' THEN p_prazo END,
    valor_estimado=CASE WHEN p_situacao='estimado' THEN p_valor_estimado END,
    valor_confirmado=CASE WHEN p_situacao='sem_impacto' THEN 0 WHEN p_situacao='confirmado' THEN p_valor_confirmado END,
    responsavel_financeiro=CASE WHEN p_situacao IN('estimado','confirmado') THEN p_responsavel_financeiro END,
    categoria_financeira=CASE WHEN p_situacao IN('estimado','confirmado') THEN p_categoria END,
    quantidade_bloqueada=CASE WHEN p_bloqueio='parcial' THEN p_quantidade_bloqueada END,
    percentual_bloqueado=CASE WHEN p_bloqueio='parcial' THEN p_percentual_bloqueado END,
    valor_bloqueado=v_bloqueado,observacao_financeira=p_observacao,documento_financeiro_r2_key=p_documento,updated_at=now()
  WHERE id=p_nc_id;
END $$;
REVOKE ALL ON FUNCTION atualizar_impacto_financeiro_nc(uuid,situacao_impacto_financeiro_nc,bloqueio_medicao_nc,text,uuid,date,numeric,numeric,responsavel_financeiro_nc,categoria_impacto_financeiro_nc,numeric,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION atualizar_impacto_financeiro_nc(uuid,situacao_impacto_financeiro_nc,bloqueio_medicao_nc,text,uuid,date,numeric,numeric,responsavel_financeiro_nc,categoria_impacto_financeiro_nc,numeric,numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION audit_nc_financeiro() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
END $$;

CREATE OR REPLACE VIEW vw_indicadores_medicoes WITH(security_invoker=true) AS
WITH saldos AS (
 SELECT obra_id,sum(disponivel)::numeric(18,6) quantidade_disponivel,sum(valor_disponivel)::numeric(18,4) valor_disponivel,
   sum(medido)::numeric(18,6) quantidade_medida,sum(bloqueado)::numeric(18,6) quantidade_bloqueada
 FROM vw_saldos_medicao_servico GROUP BY obra_id
), custos AS (
 SELECT nc_obra(id) obra_id,
  sum(valor_estimado) FILTER(WHERE situacao_financeira='estimado')::numeric(18,4) custo_estimado_retrabalho,
  sum(valor_confirmado) FILTER(WHERE situacao_financeira='confirmado')::numeric(18,4) custo_confirmado_retrabalho
 FROM nao_conformidades GROUP BY nc_obra(id)
)
SELECT o.id obra_id,COALESCE(s.quantidade_disponivel,0)::numeric(18,6) quantidade_disponivel,COALESCE(s.valor_disponivel,0)::numeric(18,4) valor_disponivel,
 COALESCE(s.quantidade_medida,0)::numeric(18,6) quantidade_medida,COALESCE(s.quantidade_bloqueada,0)::numeric(18,6) quantidade_bloqueada,
 COALESCE(c.custo_estimado_retrabalho,0)::numeric(18,4) custo_estimado_retrabalho,COALESCE(c.custo_confirmado_retrabalho,0)::numeric(18,4) custo_confirmado_retrabalho
FROM obras o LEFT JOIN saldos s ON s.obra_id=o.id LEFT JOIN custos c ON c.obra_id=o.id;

GRANT SELECT ON vw_indicadores_medicoes TO authenticated;
REVOKE ALL ON FUNCTION protect_medicao_history(),audit_nc_financeiro() FROM PUBLIC,anon,authenticated;
