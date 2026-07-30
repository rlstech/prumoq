-- Mantem o status da obra sincronizado com as FVS dos ambientes ativos.
-- Obras paralisadas continuam sob controle manual e obras sem FVS preservam
-- o status cadastral atual.

DROP TRIGGER IF EXISTS trg_update_obra_status ON public.fvs_planejadas;
DROP FUNCTION IF EXISTS public.update_obra_status_from_fvs();

CREATE OR REPLACE FUNCTION public.sync_obra_status_from_fvs(p_obra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.sync_obra_status_from_fvs(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_obra_status_after_fvs_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.sync_obra_status_after_fvs_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_obra_status_after_fvs_change
  ON public.fvs_planejadas;
CREATE TRIGGER trg_sync_obra_status_after_fvs_change
  AFTER INSERT OR DELETE OR UPDATE OF status, ambiente_id
  ON public.fvs_planejadas
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_obra_status_after_fvs_change();

CREATE OR REPLACE FUNCTION public.sync_obra_status_after_ambiente_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.sync_obra_status_after_ambiente_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_obra_status_after_ambiente_change
  ON public.ambientes;
CREATE TRIGGER trg_sync_obra_status_after_ambiente_change
  AFTER DELETE OR UPDATE OF ativo, obra_id
  ON public.ambientes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_obra_status_after_ambiente_change();

-- Corrige obras existentes que ficaram concluidas abaixo de 100% e tambem
-- conclui obras que ja possuem todas as FVS ativas finalizadas.
DO $$
DECLARE
  v_obra record;
BEGIN
  FOR v_obra IN
    SELECT o.id
    FROM public.obras o
    WHERE o.ativo = true
    ORDER BY o.id
  LOOP
    PERFORM public.sync_obra_status_from_fvs(v_obra.id);
  END LOOP;
END;
$$;
