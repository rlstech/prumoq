-- Migration 011: FVS lifecycle — novos estados, tabelas de conclusão e reabertura
-- Ref: references/fvs-lifecycle.md

-- ─────────────────────────────────────────────
-- 1. Novos valores no enum status_fvs
-- ─────────────────────────────────────────────
-- ALTER TYPE ADD VALUE não pode rodar dentro de uma transação com outras DDLs
-- em algumas versões do Postgres. Por segurança, cada ADD VALUE é um statement.
ALTER TYPE status_fvs ADD VALUE IF NOT EXISTS 'concluida';
ALTER TYPE status_fvs ADD VALUE IF NOT EXISTS 'em_revisao';
ALTER TYPE status_fvs ADD VALUE IF NOT EXISTS 'concluida_ressalva';

-- ─────────────────────────────────────────────
-- 2. Novos campos em fvs_planejadas
-- ─────────────────────────────────────────────
ALTER TABLE fvs_planejadas
  ADD COLUMN IF NOT EXISTS total_reaberturas    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_conclusoes     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_conclusao_em  timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_reabertura_em timestamptz;

-- ─────────────────────────────────────────────
-- 3. Tabela fvs_conclusoes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fvs_conclusoes (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  fvs_planejada_id    uuid        NOT NULL REFERENCES fvs_planejadas(id) ON DELETE CASCADE,
  inspetor_id         uuid        NOT NULL REFERENCES usuarios(id),
  numero_conclusao    integer     NOT NULL DEFAULT 1,
  percentual_final    integer     NOT NULL,
  resultado           text        NOT NULL CHECK (resultado IN ('aprovado', 'com_ressalva')),
  motivo_antes_100    text,
  tipo_motivo         text,
  observacao_final    text,
  assinatura_url      text,
  assinada_em         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fvs_conclusoes_fvs_planejada
  ON fvs_conclusoes(fvs_planejada_id);

-- ─────────────────────────────────────────────
-- 4. Tabela fvs_reaberturas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fvs_reaberturas (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  fvs_planejada_id    uuid        NOT NULL REFERENCES fvs_planejadas(id) ON DELETE CASCADE,
  solicitado_por      uuid        NOT NULL REFERENCES usuarios(id),
  autorizado_por      uuid        NOT NULL REFERENCES usuarios(id),
  motivo_tipo         text        NOT NULL CHECK (motivo_tipo IN (
                                    'reclamacao_cliente',
                                    'auditoria_interna',
                                    'servico_complementar',
                                    'correcao_registro',
                                    'determinacao_engenharia',
                                    'outro'
                                  )),
  justificativa       text        NOT NULL,
  numero_reabertura   integer     NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fvs_reaberturas_fvs_planejada
  ON fvs_reaberturas(fvs_planejada_id);

-- ─────────────────────────────────────────────
-- 5. Atualizar trigger update_fvs_status
--    O trigger anterior copiava status da verificação para fvs_planejadas.
--    Com o novo ciclo de vida:
--    - FVS concluída/concluida_ressalva → não alterar (bloqueada)
--    - FVS em_revisao → manter em_revisao após nova verificação (RN-FVS-05)
--    - Demais casos → mover para em_andamento
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_fvs_status()
RETURNS trigger AS $$
DECLARE
  v_status_atual status_fvs;
BEGIN
  SELECT status INTO v_status_atual
  FROM fvs_planejadas
  WHERE id = NEW.fvs_planejada_id;

  -- FVS concluída: bloquear qualquer atualização de status via verificação
  IF v_status_atual IN ('concluida', 'concluida_ressalva') THEN
    RETURN NEW;
  END IF;

  -- FVS em revisão: manter em_revisao (não regredir para em_andamento)
  IF v_status_atual = 'em_revisao' THEN
    UPDATE fvs_planejadas
    SET updated_at = now()
    WHERE id = NEW.fvs_planejada_id;
    RETURN NEW;
  END IF;

  -- Demais casos (pendente → em_andamento)
  UPDATE fvs_planejadas
  SET
    status       = 'em_andamento',
    concluida_em = NULL,
    updated_at   = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 6. RLS — fvs_conclusoes
-- ─────────────────────────────────────────────
ALTER TABLE fvs_conclusoes ENABLE ROW LEVEL SECURITY;

-- Leitura: quem tem acesso à FVS planejada pode ler as conclusões
CREATE POLICY "leitura_fvs_conclusoes" ON fvs_conclusoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fvs_planejadas fp
      JOIN ambientes a ON a.id = fp.ambiente_id
      JOIN obra_usuarios ou ON ou.obra_id = a.obra_id
      WHERE fp.id = fvs_conclusoes.fvs_planejada_id
        AND ou.usuario_id = auth.uid()
        AND ou.ativo = true
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.perfil IN ('admin', 'gestor')
    )
  );

-- Inserção: qualquer inspetor com acesso à obra pode registrar conclusão
CREATE POLICY "insercao_fvs_conclusoes" ON fvs_conclusoes
  FOR INSERT WITH CHECK (
    inspetor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM fvs_planejadas fp
      JOIN ambientes a ON a.id = fp.ambiente_id
      JOIN obra_usuarios ou ON ou.obra_id = a.obra_id
      WHERE fp.id = fvs_conclusoes.fvs_planejada_id
        AND ou.usuario_id = auth.uid()
        AND ou.ativo = true
    )
  );

-- ─────────────────────────────────────────────
-- 7. RLS — fvs_reaberturas
-- ─────────────────────────────────────────────
ALTER TABLE fvs_reaberturas ENABLE ROW LEVEL SECURITY;

-- Leitura: quem tem acesso à obra
CREATE POLICY "leitura_fvs_reaberturas" ON fvs_reaberturas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fvs_planejadas fp
      JOIN ambientes a ON a.id = fp.ambiente_id
      JOIN obra_usuarios ou ON ou.obra_id = a.obra_id
      WHERE fp.id = fvs_reaberturas.fvs_planejada_id
        AND ou.usuario_id = auth.uid()
        AND ou.ativo = true
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.perfil IN ('admin', 'gestor')
    )
  );

-- Inserção: quem solicitou deve ter acesso à obra
CREATE POLICY "insercao_fvs_reaberturas" ON fvs_reaberturas
  FOR INSERT WITH CHECK (
    solicitado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM fvs_planejadas fp
      JOIN ambientes a ON a.id = fp.ambiente_id
      JOIN obra_usuarios ou ON ou.obra_id = a.obra_id
      WHERE fp.id = fvs_reaberturas.fvs_planejada_id
        AND ou.usuario_id = auth.uid()
        AND ou.ativo = true
    )
  );
