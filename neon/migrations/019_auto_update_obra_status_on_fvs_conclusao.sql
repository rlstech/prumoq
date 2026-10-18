-- Trigger: quando todas as FVS de uma obra ficam concluidas/concluida_ressalva,
-- atualiza obras.status = 'concluida'. Se alguma FVS regredir, reverte para 'em_andamento'.

CREATE OR REPLACE FUNCTION update_obra_status_from_fvs()
RETURNS trigger AS $$
DECLARE
  v_obra_id        uuid;
  v_total_fvs      bigint;
  v_fvs_concluidas bigint;
BEGIN
  SELECT a.obra_id INTO v_obra_id
  FROM ambientes a
  WHERE a.id = NEW.ambiente_id;

  IF v_obra_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN 1 END)
  INTO v_total_fvs, v_fvs_concluidas
  FROM fvs_planejadas f
  JOIN ambientes a ON a.id = f.ambiente_id
  WHERE a.obra_id = v_obra_id;

  IF v_total_fvs > 0 AND v_total_fvs = v_fvs_concluidas THEN
    UPDATE obras SET status = 'concluida', updated_at = now()
    WHERE id = v_obra_id AND status != 'concluida';
  ELSIF v_fvs_concluidas < v_total_fvs THEN
    UPDATE obras SET status = 'em_andamento', updated_at = now()
    WHERE id = v_obra_id AND status = 'concluida';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_obra_status
  AFTER INSERT OR UPDATE OF status ON fvs_planejadas
  FOR EACH ROW EXECUTE FUNCTION update_obra_status_from_fvs();

-- Corrige obras existentes que já deveriam estar como 'concluida'
UPDATE obras o
SET status = 'concluida', updated_at = now()
WHERE o.ativo = true
  AND o.status != 'concluida'
  AND (
    SELECT COUNT(*) FROM fvs_planejadas f
    JOIN ambientes a ON a.id = f.ambiente_id
    WHERE a.obra_id = o.id
  ) > 0
  AND (
    SELECT COUNT(*) FROM fvs_planejadas f
    JOIN ambientes a ON a.id = f.ambiente_id
    WHERE a.obra_id = o.id
      AND f.status NOT IN ('conforme','concluida','concluida_ressalva')
  ) = 0;
