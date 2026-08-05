-- Controles finais de integridade para os módulos opcionais.
-- Esta migration não altera históricos: apenas restringe novas gravações e
-- disponibiliza uma operação limitada para a sobreposição por obra.

CREATE OR REPLACE FUNCTION set_obra_feature_overrides(
  p_obra_id uuid,
  p_medicoes_override boolean,
  p_financeiro_override boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION set_obra_feature_overrides(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_obra_feature_overrides(uuid, boolean, boolean) TO authenticated;

-- Uma NC com bloqueio total zera o saldo do vínculo; bloqueios parciais se
-- somam uma única vez por NC ativa. A resolução devolve automaticamente o saldo.
CREATE OR REPLACE FUNCTION saldo_vinculo_execucao(p_vinculo uuid)
RETURNS TABLE(aprovado numeric, medido numeric, bloqueado numeric, disponivel numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH a AS (
    SELECT COALESCE(max(aprovado_atual), 0) AS v
    FROM avancos_aprovados_servico
    WHERE vinculacao_id = p_vinculo
  ), m AS (
    SELECT COALESCE(sum(i.quantidade_periodo), 0) AS v
    FROM medicao_servico_itens i
    JOIN medicoes_servico h ON h.id = i.medicao_id
    WHERE i.vinculacao_id = p_vinculo
      AND i.tipo = 'avanco'
      AND h.status = 'aprovada'
  ), b AS (
    SELECT
      bool_or(n.bloqueio_medicao = 'total') AS total,
      COALESCE(sum(CASE WHEN n.bloqueio_medicao = 'parcial'
        THEN COALESCE(n.quantidade_bloqueada, 0) ELSE 0 END), 0) AS parcial
    FROM nao_conformidades n
    JOIN verificacoes ver ON ver.id = n.verificacao_id
    JOIN avancos_aprovados_servico aa ON aa.verificacao_id = ver.id
    WHERE aa.vinculacao_id = p_vinculo
      AND n.status IN ('aberta', 'em_correcao')
  )
  SELECT a.v, m.v,
    CASE WHEN b.total THEN greatest(a.v - m.v, 0) ELSE b.parcial END,
    CASE WHEN b.total THEN 0 ELSE greatest(0, a.v - m.v - b.parcial) END
  FROM a, m, b;
$$;

-- Configuração, vínculos, cabeçalhos e itens só existem quando o módulo está
-- efetivamente habilitado na obra. Esta validação é feita no banco, além da UI.
CREATE OR REPLACE FUNCTION validate_medicao_feature_enabled()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_medicao_feature_config ON fvs_medicao_configuracoes;
CREATE TRIGGER trg_medicao_feature_config
BEFORE INSERT OR UPDATE ON fvs_medicao_configuracoes
FOR EACH ROW EXECUTE FUNCTION validate_medicao_feature_enabled();
DROP TRIGGER IF EXISTS trg_medicao_feature_vinculo ON vinculos_execucao_servico;
CREATE TRIGGER trg_medicao_feature_vinculo
BEFORE INSERT ON vinculos_execucao_servico
FOR EACH ROW EXECUTE FUNCTION validate_medicao_feature_enabled();
DROP TRIGGER IF EXISTS trg_medicao_feature_cabecalho ON medicoes_servico;
CREATE TRIGGER trg_medicao_feature_cabecalho
BEFORE INSERT ON medicoes_servico
FOR EACH ROW EXECUTE FUNCTION validate_medicao_feature_enabled();
DROP TRIGGER IF EXISTS trg_medicao_feature_item ON medicao_servico_itens;
CREATE TRIGGER trg_medicao_feature_item
BEFORE INSERT ON medicao_servico_itens
FOR EACH ROW EXECUTE FUNCTION validate_medicao_feature_enabled();

-- Garante que item, vínculo, etapa e cabeçalho pertençam ao mesmo escopo.
CREATE OR REPLACE FUNCTION validate_medicao_item_scope()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
$$;
DROP TRIGGER IF EXISTS trg_medicao_item_scope ON medicao_servico_itens;
CREATE TRIGGER trg_medicao_item_scope
BEFORE INSERT OR UPDATE ON medicao_servico_itens
FOR EACH ROW EXECUTE FUNCTION validate_medicao_item_scope();

-- Registros financeiros e aprovados são imutáveis por escrita direta após a
-- aprovação. Correções passam pelo cancelamento auditado.
CREATE OR REPLACE FUNCTION protect_medicao_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'medicoes_servico' THEN
    IF TG_OP = 'DELETE' OR (OLD.status = 'aprovada' AND NEW.status <> 'cancelada') OR OLD.status = 'cancelada' THEN
      RAISE EXCEPTION 'Medições aprovadas ou canceladas não podem ser alteradas diretamente'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_TABLE_NAME IN ('medicao_servico_itens', 'medicao_item_liberacoes') THEN
    IF EXISTS (
      SELECT 1 FROM medicoes_servico h
      JOIN medicao_servico_itens i ON i.medicao_id = h.id
      WHERE (TG_TABLE_NAME = 'medicao_servico_itens' AND i.id = COALESCE(NEW.id, OLD.id))
         OR (TG_TABLE_NAME = 'medicao_item_liberacoes' AND i.id = COALESCE(NEW.medicao_item_id, OLD.medicao_item_id))
        AND h.status <> 'rascunho'
    ) THEN
      RAISE EXCEPTION 'Itens de medição aprovada ou cancelada são imutáveis'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_medicoes_history ON medicoes_servico;
CREATE TRIGGER trg_medicoes_history
BEFORE UPDATE OR DELETE ON medicoes_servico
FOR EACH ROW EXECUTE FUNCTION protect_medicao_history();
DROP TRIGGER IF EXISTS trg_medicao_itens_history ON medicao_servico_itens;
CREATE TRIGGER trg_medicao_itens_history
BEFORE UPDATE OR DELETE ON medicao_servico_itens
FOR EACH ROW EXECUTE FUNCTION protect_medicao_history();
DROP TRIGGER IF EXISTS trg_medicao_liberacoes_history ON medicao_item_liberacoes;
CREATE TRIGGER trg_medicao_liberacoes_history
BEFORE UPDATE OR DELETE ON medicao_item_liberacoes
FOR EACH ROW EXECUTE FUNCTION protect_medicao_history();

-- RLS dos itens precisa atravessar o cabeçalho e a obra; a policy anterior só
-- validava o perfil e permitia tentar injetar relações de outro escopo.
DROP POLICY IF EXISTS itens_medicao_write ON medicao_servico_itens;
CREATE POLICY itens_medicao_write ON medicao_servico_itens
FOR INSERT WITH CHECK (
  get_perfil() IN ('admin', 'gestor')
  AND EXISTS (
    SELECT 1 FROM medicoes_servico h
    JOIN vinculos_execucao_servico v ON v.id = vinculacao_id
    WHERE h.id = medicao_id
      AND h.equipe_id = v.equipe_id
      AND has_obra_access(h.obra_id)
      AND fvs_medicao_obra(v.fvs_planejada_id) = h.obra_id
  )
);
DROP POLICY IF EXISTS liberacoes_medicao_write ON medicao_item_liberacoes;
CREATE POLICY liberacoes_medicao_write ON medicao_item_liberacoes
FOR INSERT WITH CHECK (
  get_perfil() IN ('admin', 'gestor')
  AND EXISTS (
    SELECT 1 FROM medicao_servico_itens i
    JOIN medicoes_servico h ON h.id = i.medicao_id
    JOIN avancos_aprovados_servico a ON a.id = avanco_id
    WHERE i.id = medicao_item_id
      AND a.vinculacao_id = i.vinculacao_id
      AND has_obra_access(h.obra_id)
  )
);

REVOKE INSERT, UPDATE, DELETE ON auditoria_operacional, nc_financeiro_historico FROM authenticated;
REVOKE ALL ON FUNCTION validate_medicao_feature_enabled(), validate_medicao_item_scope(), protect_medicao_history() FROM PUBLIC, anon;
