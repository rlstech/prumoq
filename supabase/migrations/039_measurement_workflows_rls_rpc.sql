-- Regras autoritativas para medições, NC financeira e isolamento por obra.

CREATE OR REPLACE FUNCTION refresh_obra_feature_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE obras o
  SET controle_medicoes_efetivo = COALESCE(o.controle_medicoes_override, e.controle_medicoes_habilitado),
      controle_financeiro_nc_efetivo = COALESCE(o.controle_financeiro_nc_override, e.controle_financeiro_nc_habilitado)
  FROM empresas e WHERE e.id = o.empresa_id AND e.cliente_id = o.cliente_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_empresas_refresh_feature_flags
AFTER UPDATE OF controle_medicoes_habilitado, controle_financeiro_nc_habilitado ON empresas
FOR EACH STATEMENT EXECUTE FUNCTION refresh_obra_feature_flags();
CREATE TRIGGER trg_obras_refresh_feature_flags
AFTER INSERT OR UPDATE OF empresa_id, controle_medicoes_override, controle_financeiro_nc_override ON obras
FOR EACH STATEMENT EXECUTE FUNCTION refresh_obra_feature_flags();
UPDATE obras o
SET controle_medicoes_efetivo = COALESCE(o.controle_medicoes_override, e.controle_medicoes_habilitado),
    controle_financeiro_nc_efetivo = COALESCE(o.controle_financeiro_nc_override, e.controle_financeiro_nc_habilitado)
FROM empresas e WHERE e.id = o.empresa_id AND e.cliente_id = o.cliente_id;

CREATE OR REPLACE FUNCTION fvs_medicao_obra(p_fvs uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT a.obra_id FROM fvs_planejadas f JOIN ambientes a ON a.id = f.ambiente_id WHERE f.id = p_fvs
$$;
CREATE OR REPLACE FUNCTION nc_obra(p_nc uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT fvs_medicao_obra(v.fvs_planejada_id) FROM nao_conformidades n JOIN verificacoes v ON v.id = n.verificacao_id WHERE n.id = p_nc
$$;

CREATE OR REPLACE FUNCTION validate_stage_weights() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE config_id uuid := COALESCE(NEW.configuracao_id, OLD.configuracao_id); total numeric;
BEGIN
  SELECT COALESCE(sum(peso_percentual) FILTER (WHERE ativo), 0) INTO total FROM fvs_medicao_etapas WHERE configuracao_id = config_id;
  IF EXISTS (SELECT 1 FROM fvs_medicao_configuracoes WHERE id = config_id AND metodo = 'etapas_ponderadas') AND total <> 100.0000 THEN
    RAISE EXCEPTION 'Os pesos ativos das etapas devem somar exatamente 100%%' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_stage_weights
AFTER INSERT OR UPDATE OR DELETE ON fvs_medicao_etapas DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_stage_weights();

CREATE OR REPLACE FUNCTION validate_avanco_aprovado_servico() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v vinculos_execucao_servico%ROWTYPE; ultimo avancos_aprovados_servico%ROWTYPE; habilitado boolean;
BEGIN
  SELECT * INTO v FROM vinculos_execucao_servico WHERE id=NEW.vinculacao_id FOR UPDATE;
  IF NOT FOUND OR v.fvs_planejada_id <> (SELECT fvs_planejada_id FROM verificacoes WHERE id=NEW.verificacao_id) THEN
    RAISE EXCEPTION 'Avanço não pertence ao serviço da verificação' USING ERRCODE='check_violation';
  END IF;
  SELECT controle_medicoes_efetivo INTO habilitado FROM obras WHERE id=fvs_medicao_obra(v.fvs_planejada_id);
  IF NOT habilitado THEN RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE='check_violation'; END IF;
  IF NEW.etapa_id IS DISTINCT FROM v.etapa_id OR NEW.aprovado_atual > v.escopo_atribuido OR NEW.executado_atual > v.escopo_atribuido OR NEW.aprovado_atual > NEW.executado_atual THEN
    RAISE EXCEPTION 'Avanço aprovado excede o escopo ou não corresponde à etapa' USING ERRCODE='check_violation';
  END IF;
  SELECT * INTO ultimo FROM avancos_aprovados_servico WHERE vinculacao_id=NEW.vinculacao_id ORDER BY data_aprovacao DESC, created_at DESC LIMIT 1;
  IF FOUND AND (NEW.executado_anterior <> ultimo.executado_atual OR NEW.aprovado_anterior <> ultimo.aprovado_atual) THEN
    RAISE EXCEPTION 'Avanço acumulado desatualizado; recarregue o saldo antes de aprovar' USING ERRCODE='serialization_failure';
  END IF;
  IF NOT FOUND AND (NEW.executado_anterior <> 0 OR NEW.aprovado_anterior <> 0) THEN
    RAISE EXCEPTION 'Primeiro avanço deve iniciar em zero' USING ERRCODE='check_violation';
  END IF;
  IF v.etapa_id IS NOT NULL AND NOT (SELECT permite_avanco_parcial FROM fvs_medicao_etapas WHERE id=v.etapa_id) AND NEW.aprovado_atual NOT IN (0, v.escopo_atribuido) THEN
    RAISE EXCEPTION 'Etapa binária somente libera o peso completo após aprovação' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_avanco_aprovado_validate BEFORE INSERT OR UPDATE ON avancos_aprovados_servico
FOR EACH ROW EXECUTE FUNCTION validate_avanco_aprovado_servico();

CREATE OR REPLACE FUNCTION validate_nc_financeiro() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE obra uuid; enabled boolean;
BEGIN
  obra := fvs_medicao_obra((SELECT fvs_planejada_id FROM verificacoes WHERE id = NEW.verificacao_id));
  SELECT controle_financeiro_nc_efetivo INTO enabled FROM obras WHERE id = obra;
  IF TG_OP = 'INSERT' AND enabled THEN NEW.financeiro_requerido := true; END IF;
  IF NEW.financeiro_requerido AND enabled THEN
    IF NEW.situacao_financeira IS NULL OR NEW.bloqueio_medicao IS NULL THEN
      RAISE EXCEPTION 'Declare a situação financeira e o bloqueio de medição da NC' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.situacao_financeira = 'sem_impacto' AND (NULLIF(trim(COALESCE(NEW.justificativa_sem_impacto, '')), '') IS NULL OR COALESCE(NEW.valor_confirmado, 0) <> 0) THEN
      RAISE EXCEPTION 'Sem impacto exige justificativa e valor confirmado zero' USING ERRCODE = 'check_violation';
    ELSIF NEW.situacao_financeira = 'em_avaliacao' AND (NEW.responsavel_avaliacao_id IS NULL OR NEW.prazo_avaliacao IS NULL) THEN
      RAISE EXCEPTION 'Impacto em avaliação exige responsável e prazo' USING ERRCODE = 'check_violation';
    ELSIF NEW.situacao_financeira = 'estimado' AND (COALESCE(NEW.valor_estimado, 0) <= 0 OR NEW.responsavel_financeiro IS NULL OR NEW.categoria_financeira IS NULL) THEN
      RAISE EXCEPTION 'Impacto estimado exige valor, responsável e categoria' USING ERRCODE = 'check_violation';
    ELSIF NEW.situacao_financeira = 'confirmado' AND (COALESCE(NEW.valor_confirmado, 0) <= 0 OR NEW.responsavel_financeiro IS NULL OR NEW.categoria_financeira IS NULL) THEN
      RAISE EXCEPTION 'Impacto confirmado exige valor, responsável e categoria' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.bloqueio_medicao = 'parcial' AND COALESCE(NEW.quantidade_bloqueada, 0) <= 0 AND COALESCE(NEW.percentual_bloqueado, 0) <= 0 THEN
      RAISE EXCEPTION 'Bloqueio parcial exige quantidade ou percentual' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.status = 'resolvida' AND NEW.financeiro_requerido AND enabled AND NEW.situacao_financeira NOT IN ('sem_impacto', 'confirmado') THEN
    RAISE EXCEPTION 'NC em avaliação ou estimada não pode ser encerrada' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_nc_financeiro BEFORE INSERT OR UPDATE ON nao_conformidades
FOR EACH ROW EXECUTE FUNCTION validate_nc_financeiro();

CREATE OR REPLACE FUNCTION audit_nc_financeiro() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (ROW(NEW.situacao_financeira, NEW.bloqueio_medicao, NEW.valor_estimado, NEW.valor_confirmado, NEW.quantidade_bloqueada, NEW.percentual_bloqueado)
    IS DISTINCT FROM ROW(OLD.situacao_financeira, OLD.bloqueio_medicao, OLD.valor_estimado, OLD.valor_confirmado, OLD.quantidade_bloqueada, OLD.percentual_bloqueado)) THEN
    INSERT INTO nc_financeiro_historico(cliente_id, nc_id, situacao, bloqueio, dados, alterado_por)
    VALUES (NEW.cliente_id, NEW.id, NEW.situacao_financeira, NEW.bloqueio_medicao,
      jsonb_build_object('valor_estimado', NEW.valor_estimado, 'valor_confirmado', NEW.valor_confirmado, 'quantidade_bloqueada', NEW.quantidade_bloqueada, 'percentual_bloqueado', NEW.percentual_bloqueado), auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_nc_financeiro_audit AFTER INSERT OR UPDATE ON nao_conformidades
FOR EACH ROW EXECUTE FUNCTION audit_nc_financeiro();

CREATE OR REPLACE FUNCTION saldo_vinculo_execucao(p_vinculo uuid)
RETURNS TABLE(aprovado numeric, medido numeric, bloqueado numeric, disponivel numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 WITH a AS (SELECT COALESCE(max(aprovado_atual),0) v FROM avancos_aprovados_servico WHERE vinculacao_id=p_vinculo),
 m AS (SELECT COALESCE(sum(i.quantidade_periodo),0) v FROM medicao_servico_itens i JOIN medicoes_servico h ON h.id=i.medicao_id WHERE i.vinculacao_id=p_vinculo AND i.tipo='avanco' AND h.status='aprovada'),
 b AS (SELECT COALESCE(sum(CASE n.bloqueio_medicao WHEN 'parcial' THEN COALESCE(n.quantidade_bloqueada,0) ELSE 0 END),0) v FROM nao_conformidades n JOIN verificacoes v ON v.id=n.verificacao_id JOIN avancos_aprovados_servico aa ON aa.verificacao_id=v.id WHERE aa.vinculacao_id=p_vinculo AND n.status IN ('aberta','em_correcao'))
 SELECT a.v, m.v, b.v, greatest(0, a.v-m.v-b.v) FROM a,m,b
$$;

CREATE OR REPLACE FUNCTION aprovar_medicao_servico(p_medicao_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m medicoes_servico%ROWTYPE; item record; saldo record; actor uuid := auth.uid();
BEGIN
  SELECT * INTO m FROM medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR NOT has_obra_access(m.obra_id) OR get_perfil() NOT IN ('admin','gestor') THEN RAISE EXCEPTION 'Sem permissão para aprovar medição' USING ERRCODE='insufficient_privilege'; END IF;
  IF m.status <> 'rascunho' THEN RAISE EXCEPTION 'Somente medições em rascunho podem ser aprovadas' USING ERRCODE='check_violation'; END IF;
  IF NOT (SELECT controle_medicoes_efetivo FROM obras WHERE id=m.obra_id) THEN RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE='check_violation'; END IF;
  FOR item IN SELECT i.* FROM medicao_servico_itens i WHERE i.medicao_id=m.id ORDER BY i.vinculacao_id FOR UPDATE LOOP
    PERFORM 1 FROM vinculos_execucao_servico WHERE id=item.vinculacao_id FOR UPDATE;
    IF item.tipo='avanco' THEN
      SELECT * INTO saldo FROM saldo_vinculo_execucao(item.vinculacao_id);
      IF item.quantidade_periodo > saldo.disponivel THEN RAISE EXCEPTION 'Quantidade medida excede saldo aprovado disponível' USING ERRCODE='check_violation'; END IF;
      IF NOT EXISTS (SELECT 1 FROM medicao_item_liberacoes l WHERE l.medicao_item_id=item.id AND l.ativa) THEN RAISE EXCEPTION 'Item de avanço precisa conter liberações aprovadas' USING ERRCODE='check_violation'; END IF;
      IF item.quantidade_periodo <> (SELECT COALESCE(sum(a.aprovado_atual-a.aprovado_anterior),0) FROM medicao_item_liberacoes l JOIN avancos_aprovados_servico a ON a.id=l.avanco_id WHERE l.medicao_item_id=item.id AND l.ativa) THEN RAISE EXCEPTION 'A medição deve consumir liberações completas' USING ERRCODE='check_violation'; END IF;
    END IF;
  END LOOP;
  UPDATE medicoes_servico SET status='aprovada', aprovado_por=actor, aprovado_em=now(), updated_at=now() WHERE id=m.id;
  INSERT INTO auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,usuario_id) VALUES(m.cliente_id,m.obra_id,'medicao',m.id,'aprovada',actor);
END $$;

CREATE OR REPLACE FUNCTION cancelar_medicao_servico(p_medicao_id uuid, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m medicoes_servico%ROWTYPE; actor uuid := auth.uid();
BEGIN
  SELECT * INTO m FROM medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR NOT has_obra_access(m.obra_id) OR get_perfil() NOT IN ('admin','gestor') OR NULLIF(trim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Cancelamento não autorizado ou sem justificativa' USING ERRCODE='check_violation'; END IF;
  IF m.status <> 'aprovada' THEN RAISE EXCEPTION 'Somente medição aprovada pode ser cancelada' USING ERRCODE='check_violation'; END IF;
  UPDATE medicao_item_liberacoes SET ativa=false WHERE medicao_item_id IN (SELECT id FROM medicao_servico_itens WHERE medicao_id=m.id);
  UPDATE medicoes_servico SET status='cancelada', cancelado_por=actor, cancelado_em=now(), motivo_cancelamento=p_motivo, updated_at=now() WHERE id=m.id;
  INSERT INTO auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,dados,usuario_id) VALUES(m.cliente_id,m.obra_id,'medicao',m.id,'cancelada',jsonb_build_object('motivo',p_motivo),actor);
END $$;

CREATE OR REPLACE FUNCTION trocar_empreiteiro_servico(p_vinculo_id uuid, p_nova_equipe_id uuid, p_data date, p_motivo text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v vinculos_execucao_servico%ROWTYPE; novo uuid; executado numeric; aprovado numeric; medido numeric; actor uuid := auth.uid();
BEGIN
 SELECT * INTO v FROM vinculos_execucao_servico WHERE id=p_vinculo_id FOR UPDATE;
 IF NOT FOUND OR NOT has_obra_access(fvs_medicao_obra(v.fvs_planejada_id)) OR get_perfil() NOT IN ('admin','gestor') OR p_data IS NULL OR NULLIF(trim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Troca de empreiteiro inválida' USING ERRCODE='check_violation'; END IF;
 IF v.status <> 'ativo' THEN RAISE EXCEPTION 'Vínculo não está ativo' USING ERRCODE='check_violation'; END IF;
 SELECT COALESCE(max(executado_atual),0),COALESCE(max(aprovado_atual),0) INTO executado,aprovado FROM avancos_aprovados_servico WHERE vinculacao_id=v.id;
 SELECT s.medido INTO medido FROM saldo_vinculo_execucao(v.id) s;
 UPDATE vinculos_execucao_servico SET status='substituido',data_termino=p_data,motivo_encerramento=p_motivo,aprovado_congelado=aprovado,medido_congelado=medido,encerrado_por=actor,updated_at=now() WHERE id=v.id;
 INSERT INTO vinculos_execucao_servico(cliente_id,fvs_planejada_id,etapa_id,equipe_id,data_inicio,escopo_atribuido,criado_por)
 VALUES(v.cliente_id,v.fvs_planejada_id,v.etapa_id,p_nova_equipe_id,p_data,v.escopo_atribuido-executado,actor) RETURNING id INTO novo;
 INSERT INTO auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,dados,usuario_id) VALUES(v.cliente_id,fvs_medicao_obra(v.fvs_planejada_id),'vinculo_execucao',novo,'empreiteiro_trocado',jsonb_build_object('anterior',v.id,'motivo',p_motivo),actor);
 RETURN novo;
END $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['modelos_etapas_medicao','modelo_etapas_medicao_itens','fvs_medicao_configuracoes','fvs_medicao_etapas','vinculos_execucao_servico','avancos_aprovados_servico','medicoes_servico','medicao_servico_itens','medicao_item_liberacoes','auditoria_operacional','nc_financeiro_historico'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
CREATE POLICY modelos_etapas_read ON modelos_etapas_medicao FOR SELECT USING (has_cliente_access(cliente_id));
CREATE POLICY modelo_itens_read ON modelo_etapas_medicao_itens FOR SELECT USING (has_cliente_access(cliente_id));
CREATE POLICY configuracoes_medicao_read ON fvs_medicao_configuracoes FOR SELECT USING (has_fvs_access(fvs_planejada_id));
CREATE POLICY etapas_medicao_read ON fvs_medicao_etapas FOR SELECT USING (EXISTS (SELECT 1 FROM fvs_medicao_configuracoes c WHERE c.id=configuracao_id AND has_fvs_access(c.fvs_planejada_id)));
CREATE POLICY vinculos_execucao_read ON vinculos_execucao_servico FOR SELECT USING (has_fvs_access(fvs_planejada_id));
CREATE POLICY avancos_aprovados_read ON avancos_aprovados_servico FOR SELECT USING (EXISTS (SELECT 1 FROM vinculos_execucao_servico v WHERE v.id=vinculacao_id AND has_fvs_access(v.fvs_planejada_id)));
CREATE POLICY medicoes_read ON medicoes_servico FOR SELECT USING (has_obra_access(obra_id));
CREATE POLICY itens_medicao_read ON medicao_servico_itens FOR SELECT USING (EXISTS (SELECT 1 FROM medicoes_servico m WHERE m.id=medicao_id AND has_obra_access(m.obra_id)));
CREATE POLICY liberacoes_medicao_read ON medicao_item_liberacoes FOR SELECT USING (EXISTS (SELECT 1 FROM medicao_servico_itens i JOIN medicoes_servico m ON m.id=i.medicao_id WHERE i.id=medicao_item_id AND has_obra_access(m.obra_id)));
CREATE POLICY auditoria_operacional_read ON auditoria_operacional FOR SELECT USING (obra_id IS NULL OR has_obra_access(obra_id));
CREATE POLICY nc_financeiro_historico_read ON nc_financeiro_historico FOR SELECT USING (has_nc_access(nc_id));
CREATE POLICY medicoes_write ON medicoes_servico FOR INSERT WITH CHECK (has_obra_access(obra_id) AND get_perfil() IN ('admin','gestor'));
CREATE POLICY itens_medicao_write ON medicao_servico_itens FOR INSERT WITH CHECK (get_perfil() IN ('admin','gestor'));
CREATE POLICY liberacoes_medicao_write ON medicao_item_liberacoes FOR INSERT WITH CHECK (get_perfil() IN ('admin','gestor'));
CREATE POLICY avancos_write ON avancos_aprovados_servico FOR INSERT WITH CHECK (get_perfil() IN ('admin','gestor','inspetor') AND EXISTS (SELECT 1 FROM vinculos_execucao_servico v WHERE v.id=vinculacao_id AND has_fvs_access(v.fvs_planejada_id)));
CREATE POLICY modelos_medicao_admin_write ON modelos_etapas_medicao FOR ALL USING (has_cliente_access(cliente_id) AND get_perfil()='admin') WITH CHECK (has_cliente_access(cliente_id) AND get_perfil()='admin');
CREATE POLICY modelo_itens_medicao_admin_write ON modelo_etapas_medicao_itens FOR ALL USING (has_cliente_access(cliente_id) AND get_perfil()='admin') WITH CHECK (has_cliente_access(cliente_id) AND get_perfil()='admin');
CREATE POLICY configuracoes_medicao_manage ON fvs_medicao_configuracoes FOR ALL USING (has_fvs_access(fvs_planejada_id) AND get_perfil() IN ('admin','gestor')) WITH CHECK (has_fvs_access(fvs_planejada_id) AND get_perfil() IN ('admin','gestor'));
CREATE POLICY etapas_medicao_manage ON fvs_medicao_etapas FOR ALL USING (EXISTS (SELECT 1 FROM fvs_medicao_configuracoes c WHERE c.id=configuracao_id AND has_fvs_access(c.fvs_planejada_id)) AND get_perfil() IN ('admin','gestor')) WITH CHECK (get_perfil() IN ('admin','gestor'));
CREATE POLICY vinculos_execucao_manage ON vinculos_execucao_servico FOR INSERT WITH CHECK (has_fvs_access(fvs_planejada_id) AND get_perfil() IN ('admin','gestor'));
GRANT SELECT, INSERT, UPDATE ON modelos_etapas_medicao, modelo_etapas_medicao_itens, fvs_medicao_configuracoes, fvs_medicao_etapas, vinculos_execucao_servico, avancos_aprovados_servico, medicoes_servico, medicao_servico_itens, medicao_item_liberacoes, nc_financeiro_historico TO authenticated;
GRANT EXECUTE ON FUNCTION aprovar_medicao_servico(uuid), cancelar_medicao_servico(uuid,text), trocar_empreiteiro_servico(uuid,uuid,date,text), saldo_vinculo_execucao(uuid) TO authenticated;
