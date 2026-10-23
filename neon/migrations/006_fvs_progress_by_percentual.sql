-- ============================================================
-- Migration 006: progresso por percentual_exec
-- ============================================================
-- Adiciona percentual_exec em fvs_planejadas e atualiza o trigger
-- e as RPCs para calcular progresso como média ponderada dos
-- percentuais de execução, considerando verificações em andamento.
--
-- Fórmula de progresso por FVS:
--   conforme     → 100%
--   em_andamento → percentual_exec da última verificação
--   nao_conforme → 0%
--   pendente     → 0%
-- ============================================================

-- 1. Adicionar coluna percentual_exec em fvs_planejadas
ALTER TABLE fvs_planejadas
  ADD COLUMN IF NOT EXISTS percentual_exec integer NOT NULL DEFAULT 0
  CHECK (percentual_exec BETWEEN 0 AND 100);

-- 2. Recriar update_fvs_status para sincronizar percentual_exec também
CREATE OR REPLACE FUNCTION update_fvs_status()
RETURNS trigger AS $$
BEGIN
  UPDATE fvs_planejadas
  SET
    status          = NEW.status,
    percentual_exec = CASE WHEN NEW.status = 'conforme' THEN 100 ELSE NEW.percentual_exec END,
    concluida_em    = CASE WHEN NEW.status = 'conforme' THEN NOW() ELSE NULL END,
    updated_at      = NOW()
  WHERE id = NEW.fvs_planejada_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill: atualizar fvs_planejadas existentes com base na última verificação
UPDATE fvs_planejadas fp
SET
  percentual_exec = CASE
    WHEN fp.status = 'conforme' THEN 100
    WHEN v_last.percentual_exec IS NOT NULL THEN v_last.percentual_exec
    ELSE 0
  END
FROM (
  SELECT DISTINCT ON (fvs_planejada_id)
    fvs_planejada_id,
    percentual_exec
  FROM verificacoes
  ORDER BY fvs_planejada_id, created_at DESC
) v_last
WHERE fp.id = v_last.fvs_planejada_id;
