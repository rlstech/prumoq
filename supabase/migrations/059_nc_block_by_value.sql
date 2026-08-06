-- Bloqueio de medição por NC passa a ser por VALOR (R$), não por quantidade.
-- O valor bloqueado é descontado da medição somente quando o responsável
-- financeiro é o empreiteiro executor do serviço (vínculo de execução).
-- Colunas antigas (quantidade_bloqueada/percentual_bloqueado) ficam apenas
-- como fallback legado para registros anteriores.

-- ── atualizar_impacto_financeiro_nc ──────────────────────────────────────────
-- Nova assinatura: p_quantidade_bloqueada e p_percentual_bloqueado dão lugar a
-- p_valor_bloqueado (numeric). O valor é gravado diretamente em valor_bloqueado.
DROP FUNCTION IF EXISTS public.atualizar_impacto_financeiro_nc(
  uuid, situacao_impacto_financeiro_nc, bloqueio_medicao_nc, text, uuid, date,
  numeric, numeric, responsavel_financeiro_nc, categoria_impacto_financeiro_nc,
  numeric, numeric, text, text
);

CREATE OR REPLACE FUNCTION public.atualizar_impacto_financeiro_nc(
  p_nc_id uuid, p_situacao situacao_impacto_financeiro_nc, p_bloqueio bloqueio_medicao_nc, p_justificativa text,
  p_responsavel_avaliacao uuid, p_prazo date, p_valor_estimado numeric, p_valor_confirmado numeric,
  p_responsavel_financeiro responsavel_financeiro_nc, p_categoria categoria_impacto_financeiro_nc,
  p_valor_bloqueado numeric, p_observacao text, p_documento text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.atualizar_impacto_financeiro_nc(
  uuid, situacao_impacto_financeiro_nc, bloqueio_medicao_nc, text, uuid, date,
  numeric, numeric, responsavel_financeiro_nc, categoria_impacto_financeiro_nc,
  numeric, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_impacto_financeiro_nc(
  uuid, situacao_impacto_financeiro_nc, bloqueio_medicao_nc, text, uuid, date,
  numeric, numeric, responsavel_financeiro_nc, categoria_impacto_financeiro_nc,
  numeric, text, text
) TO authenticated;

-- ── saldo_vinculo_execucao ───────────────────────────────────────────────────
-- O bloqueio passa a valer apenas quando responsavel_financeiro = 'empreiteiro'.
-- Parcial: valor_bloqueado convertido em quantidade pelo preço unitário da FVS
-- (com fallback legado para quantidade_bloqueada/percentual_bloqueado).
CREATE OR REPLACE FUNCTION public.saldo_vinculo_execucao(p_vinculo uuid)
RETURNS TABLE(aprovado numeric, medido numeric, bloqueado numeric, disponivel numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
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
$$;

-- ── validate_nc_financeiro ───────────────────────────────────────────────────
-- Bloqueio parcial exige valor_bloqueado positivo (ou campos legados).
CREATE OR REPLACE FUNCTION public.validate_nc_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;
