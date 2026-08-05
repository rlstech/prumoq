-- Modelos iniciais editáveis e projeções de leitura para o painel.

CREATE OR REPLACE FUNCTION criar_modelos_medicao_empresa(p_empresa uuid, p_cliente uuid, p_usuario uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
END $$;

DO $$ DECLARE e record; BEGIN
  FOR e IN SELECT id, cliente_id FROM empresas LOOP
    PERFORM criar_modelos_medicao_empresa(e.id, e.cliente_id, NULL);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION trg_criar_modelos_medicao_empresa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM criar_modelos_medicao_empresa(NEW.id, NEW.cliente_id, auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER trg_empresa_modelos_medicao
AFTER INSERT ON empresas FOR EACH ROW EXECUTE FUNCTION trg_criar_modelos_medicao_empresa();

CREATE OR REPLACE VIEW vw_saldos_medicao_servico
WITH (security_invoker = true) AS
SELECT
  v.id AS vinculacao_id, v.cliente_id, fvs_medicao_obra(v.fvs_planejada_id) AS obra_id,
  v.fvs_planejada_id, v.etapa_id, v.equipe_id, v.escopo_atribuido,
  s.aprovado, s.medido, s.bloqueado, s.disponivel,
  c.unidade, c.preco_unitario,
  (s.disponivel * COALESCE(c.preco_unitario, 0))::numeric(18,4) AS valor_disponivel
FROM vinculos_execucao_servico v
JOIN fvs_medicao_configuracoes c ON c.fvs_planejada_id=v.fvs_planejada_id
CROSS JOIN LATERAL saldo_vinculo_execucao(v.id) s;

CREATE OR REPLACE VIEW vw_indicadores_medicoes
WITH (security_invoker = true) AS
SELECT
  o.id AS obra_id,
  COALESCE(sum(s.disponivel), 0)::numeric(18,6) AS quantidade_disponivel,
  COALESCE(sum(s.valor_disponivel), 0)::numeric(18,4) AS valor_disponivel,
  COALESCE(sum(s.medido), 0)::numeric(18,6) AS quantidade_medida,
  COALESCE(sum(s.bloqueado), 0)::numeric(18,6) AS quantidade_bloqueada,
  COALESCE(sum(n.valor_estimado) FILTER (WHERE n.situacao_financeira='estimado'),0)::numeric(18,4) AS custo_estimado_retrabalho,
  COALESCE(sum(n.valor_confirmado) FILTER (WHERE n.situacao_financeira='confirmado'),0)::numeric(18,4) AS custo_confirmado_retrabalho
FROM obras o
LEFT JOIN vw_saldos_medicao_servico s ON s.obra_id=o.id
LEFT JOIN nao_conformidades n ON nc_obra(n.id)=o.id
GROUP BY o.id;

GRANT SELECT ON vw_saldos_medicao_servico, vw_indicadores_medicoes TO authenticated;
REVOKE ALL ON FUNCTION criar_modelos_medicao_empresa(uuid,uuid,uuid) FROM PUBLIC;
