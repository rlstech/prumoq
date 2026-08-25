-- Indicadores de medição em R$: expõe valor medido e valor bloqueado por NC
-- além das quantidades. Valor = quantidade × preço unitário da FVS, seguindo o
-- mesmo padrão do valor_disponivel já existente.
-- As novas colunas são anexadas ao FINAL das views (CREATE OR REPLACE VIEW
-- casa colunas por posição — não é possível inserir no meio).

-- ── vw_saldos_medicao_servico ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_saldos_medicao_servico
WITH (security_invoker = true) AS
SELECT
  v.id AS vinculacao_id, v.cliente_id, fvs_medicao_obra(v.fvs_planejada_id) AS obra_id,
  v.fvs_planejada_id, v.etapa_id, v.equipe_id, v.escopo_atribuido,
  s.aprovado, s.medido, s.bloqueado, s.disponivel,
  c.unidade, c.preco_unitario,
  (s.disponivel * COALESCE(c.preco_unitario, 0))::numeric(18,4) AS valor_disponivel,
  (s.medido * COALESCE(c.preco_unitario, 0))::numeric(18,4) AS valor_medido,
  (s.bloqueado * COALESCE(c.preco_unitario, 0))::numeric(18,4) AS valor_bloqueado
FROM vinculos_execucao_servico v
JOIN fvs_medicao_configuracoes c ON c.fvs_planejada_id=v.fvs_planejada_id
CROSS JOIN LATERAL saldo_vinculo_execucao(v.id) s;

-- ── vw_indicadores_medicoes ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_indicadores_medicoes
WITH (security_invoker = true) AS
WITH saldos AS (
 SELECT obra_id,
   sum(disponivel)::numeric(18,6) quantidade_disponivel,
   sum(valor_disponivel)::numeric(18,4) valor_disponivel,
   sum(medido)::numeric(18,6) quantidade_medida,
   sum(bloqueado)::numeric(18,6) quantidade_bloqueada,
   sum(valor_medido)::numeric(18,4) valor_medido,
   sum(valor_bloqueado)::numeric(18,4) valor_bloqueado
 FROM vw_saldos_medicao_servico GROUP BY obra_id
), custos AS (
 SELECT nc_obra(id) obra_id,
  sum(valor_estimado) FILTER(WHERE situacao_financeira='estimado')::numeric(18,4) custo_estimado_retrabalho,
  sum(valor_confirmado) FILTER(WHERE situacao_financeira='confirmado')::numeric(18,4) custo_confirmado_retrabalho
 FROM nao_conformidades GROUP BY nc_obra(id)
)
SELECT o.id obra_id,
 COALESCE(s.quantidade_disponivel,0)::numeric(18,6) quantidade_disponivel,
 COALESCE(s.valor_disponivel,0)::numeric(18,4) valor_disponivel,
 COALESCE(s.quantidade_medida,0)::numeric(18,6) quantidade_medida,
 COALESCE(s.quantidade_bloqueada,0)::numeric(18,6) quantidade_bloqueada,
 COALESCE(c.custo_estimado_retrabalho,0)::numeric(18,4) custo_estimado_retrabalho,
 COALESCE(c.custo_confirmado_retrabalho,0)::numeric(18,4) custo_confirmado_retrabalho,
 COALESCE(s.valor_medido,0)::numeric(18,4) valor_medido,
 COALESCE(s.valor_bloqueado,0)::numeric(18,4) valor_bloqueado
FROM obras o LEFT JOIN saldos s ON s.obra_id=o.id LEFT JOIN custos c ON c.obra_id=o.id;

GRANT SELECT ON public.vw_saldos_medicao_servico, public.vw_indicadores_medicoes TO authenticated;
REVOKE ALL ON TABLE public.vw_saldos_medicao_servico, public.vw_indicadores_medicoes FROM anon;
