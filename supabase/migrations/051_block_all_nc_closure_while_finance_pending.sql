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
      AND COALESCE(NEW.quantidade_bloqueada,0)<=0
      AND COALESCE(NEW.percentual_bloqueado,0)<=0 THEN
      RAISE EXCEPTION 'Bloqueio parcial exige quantidade ou percentual' USING ERRCODE='check_violation';
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

REVOKE ALL ON FUNCTION public.validate_nc_financeiro() FROM PUBLIC, anon;
