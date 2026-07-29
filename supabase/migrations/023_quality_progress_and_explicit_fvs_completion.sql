-- Progresso de qualidade baseado apenas em FVS concluídas.
-- Percentuais de execução legados são preservados, mas deixam de participar
-- dos cálculos e do ciclo de vida.

ALTER TABLE fvs_conclusoes
  ADD COLUMN IF NOT EXISTS verificacao_id uuid
  REFERENCES verificacoes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fvs_conclusoes_verificacao
  ON fvs_conclusoes(verificacao_id)
  WHERE verificacao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_fvs_conclusao()
RETURNS trigger AS $$
DECLARE
  v_status_atual status_fvs;
BEGIN
  -- O PowerSync pode reenviar um PUT já confirmado. O upsert precisa alcançar
  -- o ON CONFLICT sem ser bloqueado pela FVS que a própria linha concluiu.
  IF EXISTS (
    SELECT 1
    FROM fvs_conclusoes fc
    WHERE fc.id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT status
  INTO v_status_atual
  FROM fvs_planejadas
  WHERE id = NEW.fvs_planejada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FVS não encontrada';
  END IF;

  IF v_status_atual IN ('conforme', 'concluida', 'concluida_ressalva') THEN
    RAISE EXCEPTION 'A FVS já está concluída';
  END IF;

  IF NEW.verificacao_id IS NULL THEN
    RAISE EXCEPTION 'A conclusão deve referenciar uma verificação';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM verificacoes v
    WHERE v.id = NEW.verificacao_id
      AND v.fvs_planejada_id = NEW.fvs_planejada_id
      AND v.status = 'conforme'
  ) THEN
    RAISE EXCEPTION 'A conclusão deve referenciar uma verificação conforme da mesma FVS';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM verificacao_itens vi
    WHERE vi.verificacao_id = NEW.verificacao_id
  ) OR EXISTS (
    SELECT 1
    FROM verificacao_itens vi
    WHERE vi.verificacao_id = NEW.verificacao_id
      AND vi.resultado = 'nao_conforme'
  ) THEN
    RAISE EXCEPTION 'Todos os itens da verificação devem estar conforme ou não aplicáveis';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM nc_reinspecoes nr
    WHERE nr.verificacao_id = NEW.verificacao_id
  ) THEN
    RAISE EXCEPTION 'Uma reinspeção não pode concluir a FVS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM nao_conformidades nc
    JOIN verificacoes v ON v.id = nc.verificacao_id
    WHERE v.fvs_planejada_id = NEW.fvs_planejada_id
      AND nc.status IN ('aberta', 'em_correcao')
  ) THEN
    RAISE EXCEPTION 'Não é possível concluir uma FVS com NC não resolvida';
  END IF;

  NEW.numero_conclusao := (
    SELECT COUNT(*)::integer + 1
    FROM fvs_conclusoes fc
    WHERE fc.fvs_planejada_id = NEW.fvs_planejada_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_fvs_conclusao ON fvs_conclusoes;
CREATE TRIGGER trg_validate_fvs_conclusao
  BEFORE INSERT ON fvs_conclusoes
  FOR EACH ROW EXECUTE FUNCTION validate_fvs_conclusao();

CREATE OR REPLACE FUNCTION apply_fvs_conclusao()
RETURNS trigger AS $$
BEGIN
  UPDATE fvs_planejadas
  SET
    status = 'concluida',
    percentual_exec = 100,
    concluida_em = NEW.created_at,
    ultima_conclusao_em = NEW.created_at,
    total_conclusoes = (
      SELECT COUNT(*)::integer
      FROM fvs_conclusoes fc
      WHERE fc.fvs_planejada_id = NEW.fvs_planejada_id
    ),
    updated_at = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_apply_fvs_conclusao ON fvs_conclusoes;
CREATE TRIGGER trg_apply_fvs_conclusao
  AFTER INSERT ON fvs_conclusoes
  FOR EACH ROW EXECUTE FUNCTION apply_fvs_conclusao();

CREATE OR REPLACE FUNCTION apply_fvs_reabertura()
RETURNS trigger AS $$
BEGIN
  UPDATE fvs_planejadas
  SET
    status = 'em_revisao',
    concluida_em = NULL,
    ultima_reabertura_em = NEW.created_at,
    total_reaberturas = (
      SELECT COUNT(*)::integer
      FROM fvs_reaberturas fr
      WHERE fr.fvs_planejada_id = NEW.fvs_planejada_id
    ),
    updated_at = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_apply_fvs_reabertura ON fvs_reaberturas;
CREATE TRIGGER trg_apply_fvs_reabertura
  AFTER INSERT ON fvs_reaberturas
  FOR EACH ROW EXECUTE FUNCTION apply_fvs_reabertura();

-- Uma verificação registra o resultado daquele dia. Ela inicia ou mantém o
-- acompanhamento da FVS, mas nunca a conclui implicitamente.
CREATE OR REPLACE FUNCTION update_fvs_status()
RETURNS trigger AS $$
DECLARE
  v_status_atual status_fvs;
BEGIN
  SELECT status INTO v_status_atual
  FROM fvs_planejadas
  WHERE id = NEW.fvs_planejada_id;

  IF v_status_atual IN ('conforme', 'concluida', 'concluida_ressalva') THEN
    RETURN NEW;
  END IF;

  IF v_status_atual = 'em_revisao' THEN
    UPDATE fvs_planejadas
    SET updated_at = now()
    WHERE id = NEW.fvs_planejada_id;
    RETURN NEW;
  END IF;

  UPDATE fvs_planejadas
  SET
    status = 'em_andamento',
    concluida_em = NULL,
    updated_at = now()
  WHERE id = NEW.fvs_planejada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Progresso de FVS não representa o status cadastral/cronológico da obra.
DROP TRIGGER IF EXISTS trg_update_obra_status ON fvs_planejadas;

-- O estado não conforme era copiado da última verificação para a FVS.
-- A partir desta regra, a NC é um alerta separado e a FVS permanece aberta.
UPDATE fvs_planejadas
SET
  status = 'em_andamento',
  concluida_em = NULL,
  updated_at = now()
WHERE status = 'nao_conforme';

CREATE OR REPLACE VIEW public.v_obras_com_fvs AS
SELECT
  o.id,
  o.nome,
  o.status,
  o.endereco,
  o.municipio,
  o.uf,
  o.eng_responsavel AS engenheiro_nome,
  o.crea_cau AS engenheiro_crea,
  e.nome AS empresa_nome,
  COUNT(DISTINCT a.id) AS total_ambientes,
  COUNT(DISTINCT f.id) AS total_fvs,
  COUNT(DISTINCT CASE
    WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
  END) AS fvs_concluidas,
  COALESCE(
    COUNT(DISTINCT CASE
      WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
    END)::double precision * 100.0 / NULLIF(COUNT(DISTINCT f.id), 0),
    0
  ) AS progresso_percentual,
  (
    SELECT COUNT(*)
    FROM nao_conformidades n
    JOIN verificacoes v ON v.id = n.verificacao_id
    JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
    JOIN ambientes a2 ON a2.id = fp2.ambiente_id
    WHERE a2.obra_id = o.id
      AND a2.ativo = true
      AND n.status IN ('aberta', 'em_correcao')
  ) AS ncs_abertas
FROM obras o
  LEFT JOIN empresas e ON e.id = o.empresa_id
  LEFT JOIN ambientes a ON a.obra_id = o.id AND a.ativo = true
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
WHERE o.ativo = true
GROUP BY o.id, e.nome
ORDER BY o.nome;

CREATE OR REPLACE FUNCTION public.get_obra_kpi(p_obra_id uuid)
RETURNS TABLE(
  total_ambientes bigint,
  total_fvs bigint,
  fvs_concluidas bigint,
  ncs_abertas bigint,
  progresso_percentual double precision
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT
    COUNT(DISTINCT a.id),
    COUNT(DISTINCT f.id),
    COUNT(DISTINCT CASE
      WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
    END),
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      JOIN verificacoes v ON v.id = n.verificacao_id
      JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
      JOIN ambientes a2 ON a2.id = fp2.ambiente_id
      WHERE a2.obra_id = p_obra_id
        AND a2.ativo = true
        AND n.status IN ('aberta', 'em_correcao')
    ),
    COALESCE(
      COUNT(DISTINCT CASE
        WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
      END)::double precision * 100.0 / NULLIF(COUNT(DISTINCT f.id), 0),
      0
    )
  FROM obras o
  LEFT JOIN ambientes a ON a.obra_id = o.id AND a.ativo = true
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE o.id = p_obra_id;
$$;

CREATE OR REPLACE FUNCTION public.get_ambientes_obra(p_obra_id uuid)
RETURNS TABLE(
  id uuid,
  nome text,
  tipo text,
  localizacao text,
  total_fvs bigint,
  fvs_concluidas bigint,
  ncs_abertas bigint,
  progresso_percentual double precision
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT
    a.id,
    a.nome,
    a.tipo::text,
    a.localizacao,
    COUNT(DISTINCT f.id),
    COUNT(DISTINCT CASE
      WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
    END),
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      JOIN verificacoes v ON v.id = n.verificacao_id
      JOIN fvs_planejadas fp2 ON fp2.id = v.fvs_planejada_id
      WHERE fp2.ambiente_id = a.id
        AND n.status IN ('aberta', 'em_correcao')
    ),
    COALESCE(
      COUNT(DISTINCT CASE
        WHEN f.status IN ('conforme', 'concluida', 'concluida_ressalva') THEN f.id
      END)::double precision * 100.0 / NULLIF(COUNT(DISTINCT f.id), 0),
      0
    )
  FROM ambientes a
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE a.obra_id = p_obra_id
    AND a.ativo = true
  GROUP BY a.id
  ORDER BY a.nome;
$$;

CREATE OR REPLACE FUNCTION public.get_obras_progresso_dashboard()
RETURNS TABLE (
  id uuid,
  nome text,
  status text,
  municipio text,
  uf text,
  empresa_nome text,
  total_ambientes bigint,
  total_fvs bigint,
  fvs_concluidas bigint,
  progresso_percentual double precision,
  ncs_abertas bigint
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT
    v.id,
    v.nome,
    v.status::text,
    v.municipio,
    v.uf,
    v.empresa_nome,
    v.total_ambientes,
    v.total_fvs,
    v.fvs_concluidas,
    v.progresso_percentual,
    v.ncs_abertas
  FROM public.v_obras_com_fvs v
  ORDER BY v.nome
  LIMIT 5;
$$;

DROP FUNCTION IF EXISTS public.get_fvs_ambiente(uuid);
CREATE FUNCTION public.get_fvs_ambiente(p_ambiente_id uuid)
RETURNS TABLE (
  id uuid,
  subservico text,
  status text,
  total_verificacoes bigint,
  ultima_verif date,
  ncs_abertas bigint
)
LANGUAGE sql SECURITY INVOKER STABLE AS $$
  SELECT
    fp.id,
    fp.subservico,
    fp.status::text,
    COUNT(DISTINCT v.id),
    MAX(v.data_verif),
    (
      SELECT COUNT(*)
      FROM nao_conformidades n
      JOIN verificacoes vn ON vn.id = n.verificacao_id
      WHERE vn.fvs_planejada_id = fp.id
        AND n.status IN ('aberta', 'em_correcao')
    )
  FROM fvs_planejadas fp
  LEFT JOIN verificacoes v ON v.fvs_planejada_id = fp.id
  WHERE fp.ambiente_id = p_ambiente_id
  GROUP BY fp.id
  ORDER BY fp.subservico;
$$;
