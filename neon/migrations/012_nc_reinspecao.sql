-- ============================================================
-- PrumoQ — Migration 012: Fluxo de re-inspeção de NC
-- ============================================================

-- 1. Novo valor no enum status_nc
ALTER TYPE status_nc ADD VALUE IF NOT EXISTS 'encerrada_sem_resolucao';

-- 2. Novo campo em nao_conformidades: link para NC de origem
--    (preenchido quando esta NC foi gerada por uma re-inspeção reprovada)
ALTER TABLE nao_conformidades
  ADD COLUMN IF NOT EXISTS nc_origem_id uuid references nao_conformidades(id) on delete set null;

CREATE INDEX IF NOT EXISTS idx_nc_origem ON nao_conformidades(nc_origem_id);

-- 3. Tabela nc_reinspecoes
CREATE TABLE nc_reinspecoes (
  id                  uuid primary key default uuid_generate_v4(),
  nc_id               uuid not null references nao_conformidades(id) on delete cascade,
  verificacao_id      uuid references verificacoes(id) on delete set null,
  inspetor_id         uuid not null references usuarios(id) on delete restrict,
  equipe_id           uuid references equipes(id) on delete set null,
  data_reinspecao     date not null,
  resultado           resultado_item not null,
  observacao          text,
  foto_r2_key         text,
  foto_r2_thumb_key   text,
  assinatura_url      text,
  assinada_em         timestamptz,
  nova_nc_id          uuid references nao_conformidades(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

CREATE INDEX idx_nc_reinspecoes_nc      ON nc_reinspecoes(nc_id);
CREATE INDEX idx_nc_reinspecoes_inspetor ON nc_reinspecoes(inspetor_id);
CREATE INDEX idx_nc_reinspecoes_data    ON nc_reinspecoes(data_reinspecao);

-- RLS
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

CREATE TRIGGER trg_nc_reinspecoes_updated_at
  BEFORE UPDATE ON nc_reinspecoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
