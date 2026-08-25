-- Guarantees that an approved reinspection closes its source NC. This is
-- intentionally idempotent because older environments may have received the
-- inspection-write policies without the closure trigger from migration 062.

CREATE OR REPLACE FUNCTION public.apply_nc_reinspecao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_origem_fvs uuid;
  v_reinspecao_fvs uuid;
BEGIN
  SELECT v.fvs_planejada_id INTO v_origem_fvs
  FROM public.nao_conformidades nc
  JOIN public.verificacoes v ON v.id = nc.verificacao_id
  WHERE nc.id = NEW.nc_id
  FOR UPDATE;

  SELECT v.fvs_planejada_id INTO v_reinspecao_fvs
  FROM public.verificacoes v
  WHERE v.id = NEW.verificacao_id
    AND v.inspetor_id = NEW.inspetor_id;

  IF v_origem_fvs IS NULL OR v_reinspecao_fvs IS NULL
    OR v_origem_fvs <> v_reinspecao_fvs
    OR NEW.inspetor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Reinspecao fora do escopo autorizado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.resultado = 'aprovada' THEN
    UPDATE public.nao_conformidades
    SET status = 'resolvida',
        resolvida_em = NEW.created_at,
        verificacao_reinsp_id = NEW.verificacao_id,
        resolvida_na_verif_id = NEW.verificacao_id,
        foto_reinspecao_url = NEW.foto_url,
        updated_at = now()
    WHERE id = NEW.nc_id;
  ELSIF NEW.resultado = 'reprovada' THEN
    UPDATE public.nao_conformidades
    SET status = 'encerrada_sem_resolucao',
        updated_at = now()
    WHERE id = NEW.nc_id;
  ELSE
    RAISE EXCEPTION 'Resultado de reinspecao invalido' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_nc_reinspecao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_apply_nc_reinspecao ON public.nc_reinspecoes;
CREATE TRIGGER trg_apply_nc_reinspecao
AFTER INSERT ON public.nc_reinspecoes
FOR EACH ROW EXECUTE FUNCTION public.apply_nc_reinspecao();

-- Repair NCs that already have an approved latest reinspection but were left
-- actionable because the trigger was absent when the reinspection was saved.
WITH latest_reinspections AS (
  SELECT DISTINCT ON (nr.nc_id)
    nr.nc_id,
    nr.verificacao_id,
    nr.foto_url,
    nr.created_at,
    nr.resultado
  FROM public.nc_reinspecoes nr
  ORDER BY nr.nc_id, nr.created_at DESC, nr.id DESC
)
UPDATE public.nao_conformidades nc
SET status = 'resolvida',
    resolvida_em = latest.created_at,
    verificacao_reinsp_id = latest.verificacao_id,
    resolvida_na_verif_id = latest.verificacao_id,
    foto_reinspecao_url = latest.foto_url,
    updated_at = now()
FROM latest_reinspections latest
WHERE nc.id = latest.nc_id
  AND latest.resultado = 'aprovada'
  AND nc.status IN ('aberta', 'em_correcao');
