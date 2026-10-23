-- ============================================================
-- PrumoQ — Migration 013: Corrige schema de re-inspeção de NC
-- Alinha com nc-reinspecao.md (spec)
-- ============================================================

-- 1. Corrigir nao_conformidades
--    Renomear nc_origem_id → nc_anterior_id (nome da spec)
DROP INDEX IF EXISTS idx_nc_origem;
ALTER TABLE nao_conformidades RENAME COLUMN nc_origem_id TO nc_anterior_id;
CREATE INDEX idx_nc_anterior ON nao_conformidades(nc_anterior_id);

--    Adicionar campos que faltaram
ALTER TABLE nao_conformidades
  ADD COLUMN IF NOT EXISTS numero_ocorrencia     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS verificacao_reinsp_id uuid REFERENCES verificacoes(id),
  ADD COLUMN IF NOT EXISTS foto_reinspecao_url   text;

--    Adicionar constraint de prioridade (campo já existe)
ALTER TABLE nao_conformidades
  DROP CONSTRAINT IF EXISTS nao_conformidades_prioridade_check;
ALTER TABLE nao_conformidades
  ADD CONSTRAINT nao_conformidades_prioridade_check
  CHECK (prioridade IN ('alta', 'media', 'baixa'));

-- 2. Recriar nc_reinspecoes conforme spec
DROP TABLE IF EXISTS nc_reinspecoes;

CREATE TABLE nc_reinspecoes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nc_id           uuid NOT NULL REFERENCES nao_conformidades(id) ON DELETE CASCADE,
  verificacao_id  uuid NOT NULL REFERENCES verificacoes(id) ON DELETE RESTRICT,
  inspetor_id     uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  resultado       text NOT NULL CHECK (resultado IN ('aprovada', 'reprovada')),
  observacao      text,
  foto_url        text,
  nova_nc_id      uuid REFERENCES nao_conformidades(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nc_reinspecoes_nc       ON nc_reinspecoes(nc_id);
CREATE INDEX idx_nc_reinspecoes_inspetor ON nc_reinspecoes(inspetor_id);

ALTER TABLE nc_reinspecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_nc_reinspecoes_by_obra" ON nc_reinspecoes
  FOR ALL USING (
    nc_id IN (
      SELECT nc.id FROM nao_conformidades nc
      JOIN verificacoes v ON nc.verificacao_id = v.id
      JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
      JOIN ambientes a ON fp.ambiente_id = a.id
      WHERE a.obra_id IN (SELECT get_obras_acesso())
    )
  );
