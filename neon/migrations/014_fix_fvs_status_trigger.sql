-- Migration 014: Corrige trigger update_fvs_status
-- Problema: migration 011 removeu o tratamento de NEW.status = 'conforme',
-- fazendo com que a conclusão de FVS via verificação nunca atualizasse o status.
-- A função passava direto para o bloco "demais casos" e forçava 'em_andamento'.

CREATE OR REPLACE FUNCTION update_fvs_status()
RETURNS trigger AS $$
DECLARE
  v_status_atual status_fvs;
BEGIN
  SELECT status INTO v_status_atual
  FROM fvs_planejadas
  WHERE id = NEW.fvs_planejada_id;

  -- FVS já concluída: bloquear regressão via verificação (011)
  IF v_status_atual IN ('concluida', 'concluida_ressalva') THEN
    RETURN NEW;
  END IF;

  -- Verificação marcada como conforme → FVS concluída (restaura 001/006)
  IF NEW.status = 'conforme' THEN
    UPDATE fvs_planejadas
    SET
      status          = 'conforme',
      percentual_exec = 100,
      concluida_em    = NOW(),
      updated_at      = NOW()
    WHERE id = NEW.fvs_planejada_id;
    RETURN NEW;
  END IF;

  -- FVS em revisão: manter em_revisao (011)
  IF v_status_atual = 'em_revisao' THEN
    UPDATE fvs_planejadas
    SET updated_at = now()
    WHERE id = NEW.fvs_planejada_id;
    RETURN NEW;
  END IF;

  -- Demais casos → em_andamento (011)
  UPDATE fvs_planejadas
  SET
    status       = 'em_andamento',
    concluida_em = NULL,
    updated_at   = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
