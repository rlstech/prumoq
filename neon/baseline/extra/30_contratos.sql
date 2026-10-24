-- Contratos de empreiteiro (obra + empreiteiro + serviços). Idempotente.
-- Cada serviço medido (vinculos_execucao_servico) e cada medição (medicoes_servico) pertence a um contrato.
-- As RPCs antigas continuam iguais: um gatilho preenche o contrato a partir de `app.contrato_id` (setado pelas
-- RPCs *_contrato) ou do único contrato ativo daquele empreiteiro na obra, e recusa contrato de outra obra/empreiteiro.
-- Escrita só pelas RPCs (SECURITY DEFINER); leitura pela RLS de obra.

-- As funções de medição chamam uuid_generate_v4() sem schema (search_path public). A produção tem este
-- atalho em public; o prumoq-teste recriado não tinha. Mesma definição da produção.
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE sql
 PARALLEL SAFE
 SET search_path TO 'extensions', 'pg_temp'
AS $function$
  SELECT extensions.uuid_generate_v4()
$function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'status_contrato') THEN
    CREATE TYPE public.status_contrato AS ENUM ('ativo', 'encerrado');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  obra_id uuid NOT NULL,
  equipe_id uuid NOT NULL,
  numero text NOT NULL,
  objeto text NOT NULL,
  valor_contratado numeric(18,2),
  data_inicio date NOT NULL DEFAULT current_date,
  data_fim date,
  status public.status_contrato NOT NULL DEFAULT 'ativo',
  observacao text,
  criado_por uuid REFERENCES public.usuarios(id),
  encerrado_em timestamp with time zone,
  encerrado_por uuid REFERENCES public.usuarios(id),
  motivo_encerramento text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contratos_obra_id_cliente_fkey FOREIGN KEY (obra_id, cliente_id) REFERENCES public.obras(id, cliente_id),
  CONSTRAINT contratos_equipe_id_cliente_fkey FOREIGN KEY (equipe_id, cliente_id) REFERENCES public.equipes(id, cliente_id),
  CONSTRAINT contratos_numero_check CHECK (length(trim(numero)) > 0),
  CONSTRAINT contratos_objeto_check CHECK (length(trim(objeto)) > 0),
  CONSTRAINT contratos_valor_check CHECK (valor_contratado IS NULL OR valor_contratado >= 0),
  CONSTRAINT contratos_vigencia_check CHECK (data_fim IS NULL OR data_fim >= data_inicio),
  CONSTRAINT contratos_encerramento_check CHECK ((status = 'encerrado') = (encerrado_em IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS contratos_obra_numero_uidx ON public.contratos (obra_id, lower(numero));
CREATE INDEX IF NOT EXISTS contratos_cliente_status_idx ON public.contratos (cliente_id, status);
CREATE INDEX IF NOT EXISTS contratos_obra_equipe_idx ON public.contratos (obra_id, equipe_id);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contratos_read ON public.contratos;
CREATE POLICY contratos_read ON public.contratos AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
REVOKE ALL ON public.contratos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.contratos FROM authenticated;
GRANT SELECT ON public.contratos TO authenticated;

ALTER TABLE public.vinculos_execucao_servico ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id);
ALTER TABLE public.medicoes_servico ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id);
CREATE INDEX IF NOT EXISTS vinculos_execucao_contrato_idx ON public.vinculos_execucao_servico (contrato_id);
CREATE INDEX IF NOT EXISTS medicoes_servico_contrato_idx ON public.medicoes_servico (contrato_id, data_medicao DESC);

-- Preenche e confere o contrato de um vínculo ou de uma medição.
CREATE OR REPLACE FUNCTION public.atribuir_contrato_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_obra uuid;
  v_ctx uuid := NULLIF(current_setting('app.contrato_id', true), '')::uuid;
  v_n integer;
  v_id uuid;
  c public.contratos%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.contrato_id IS NOT DISTINCT FROM OLD.contrato_id
     AND NEW.equipe_id IS NOT DISTINCT FROM OLD.equipe_id THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'vinculos_execucao_servico' THEN
    v_obra := public.fvs_medicao_obra(NEW.fvs_planejada_id);
  ELSE
    v_obra := NEW.obra_id;
  END IF;
  IF NEW.contrato_id IS NULL AND v_ctx IS NOT NULL THEN
    NEW.contrato_id := v_ctx;
  END IF;
  IF NEW.contrato_id IS NULL THEN
    SELECT count(*), min(id::text)::uuid INTO v_n, v_id FROM public.contratos
      WHERE obra_id = v_obra AND equipe_id = NEW.equipe_id AND status = 'ativo';
    IF v_n = 1 THEN NEW.contrato_id := v_id; END IF;
  END IF;
  IF NEW.contrato_id IS NULL THEN
    RAISE EXCEPTION 'Escolha o contrato deste empreiteiro na obra' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO c FROM public.contratos WHERE id = NEW.contrato_id;
  IF NOT FOUND OR c.obra_id <> v_obra OR c.equipe_id <> NEW.equipe_id THEN
    RAISE EXCEPTION 'O contrato não é deste empreiteiro nesta obra' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' AND c.status <> 'ativo' THEN
    RAISE EXCEPTION 'Contrato encerrado não recebe serviços nem medições' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

-- Item de medição só com serviço do mesmo contrato da medição.
CREATE OR REPLACE FUNCTION public.validar_contrato_item_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (SELECT contrato_id FROM public.vinculos_execucao_servico WHERE id = NEW.vinculacao_id)
     IS DISTINCT FROM (SELECT contrato_id FROM public.medicoes_servico WHERE id = NEW.medicao_id) THEN
    RAISE EXCEPTION 'O serviço pertence a outro contrato' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

-- Contratos para o que já existe: um por par obra + empreiteiro com serviço ou medição.
DO $$
DECLARE r record;
BEGIN
  PERFORM set_config('app.measurement_controlled_write', '1', true);
  INSERT INTO public.contratos (cliente_id, obra_id, equipe_id, numero, objeto, data_inicio)
  SELECT p.cliente_id, p.obra_id, p.equipe_id,
    'CT-' || lpad((row_number() OVER (PARTITION BY p.obra_id ORDER BY e.nome, p.equipe_id))::text, 3, '0'),
    'Serviços de ' || e.nome, p.inicio
  FROM (
    SELECT cliente_id, obra_id, equipe_id, min(inicio) AS inicio FROM (
      SELECT v.cliente_id, public.fvs_medicao_obra(v.fvs_planejada_id) AS obra_id, v.equipe_id, v.data_inicio AS inicio
        FROM public.vinculos_execucao_servico v WHERE v.contrato_id IS NULL
      UNION ALL
      SELECT m.cliente_id, m.obra_id, m.equipe_id, m.periodo_inicio FROM public.medicoes_servico m WHERE m.contrato_id IS NULL
    ) x GROUP BY cliente_id, obra_id, equipe_id
  ) p
  JOIN public.equipes e ON e.id = p.equipe_id
  WHERE NOT EXISTS (SELECT 1 FROM public.contratos c WHERE c.obra_id = p.obra_id AND c.equipe_id = p.equipe_id);

  UPDATE public.vinculos_execucao_servico v SET contrato_id = c.id
    FROM public.contratos c
    WHERE v.contrato_id IS NULL AND c.obra_id = public.fvs_medicao_obra(v.fvs_planejada_id) AND c.equipe_id = v.equipe_id
      AND c.id = (SELECT min(c2.id::text)::uuid FROM public.contratos c2 WHERE c2.obra_id = c.obra_id AND c2.equipe_id = c.equipe_id);
  UPDATE public.medicoes_servico m SET contrato_id = c.id
    FROM public.contratos c
    WHERE m.contrato_id IS NULL AND c.obra_id = m.obra_id AND c.equipe_id = m.equipe_id
      AND c.id = (SELECT min(c2.id::text)::uuid FROM public.contratos c2 WHERE c2.obra_id = c.obra_id AND c2.equipe_id = c.equipe_id);
  PERFORM set_config('app.measurement_controlled_write', '', true);
END
$$;

-- Gatilhos depois da migração (o guarda de cliente exige um usuário logado).
DROP TRIGGER IF EXISTS trg_contratos_cliente_guard ON public.contratos;
CREATE TRIGGER trg_contratos_cliente_guard BEFORE INSERT OR UPDATE OF cliente_id ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cliente_id();
DROP TRIGGER IF EXISTS trg_contrato_atribuir ON public.vinculos_execucao_servico;
CREATE TRIGGER trg_contrato_atribuir BEFORE INSERT OR UPDATE ON public.vinculos_execucao_servico
  FOR EACH ROW EXECUTE FUNCTION atribuir_contrato_medicao();
DROP TRIGGER IF EXISTS trg_contrato_atribuir ON public.medicoes_servico;
CREATE TRIGGER trg_contrato_atribuir BEFORE INSERT OR UPDATE ON public.medicoes_servico
  FOR EACH ROW EXECUTE FUNCTION atribuir_contrato_medicao();
DROP TRIGGER IF EXISTS trg_contrato_item ON public.medicao_servico_itens;
CREATE TRIGGER trg_contrato_item BEFORE INSERT ON public.medicao_servico_itens
  FOR EACH ROW EXECUTE FUNCTION validar_contrato_item_medicao();

-- A referência (BM 01...) passa a ser única por contrato.
DROP INDEX IF EXISTS public.medicoes_obra_equipe_referencia_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS medicoes_contrato_referencia_uidx ON public.medicoes_servico (contrato_id, lower(referencia));

CREATE OR REPLACE FUNCTION public.salvar_contrato(
  p_contrato_id uuid, p_obra_id uuid, p_equipe_id uuid, p_numero text, p_objeto text,
  p_valor_contratado numeric, p_data_inicio date, p_data_fim date, p_observacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid := p_contrato_id;
  v_cliente uuid;
  c public.contratos%ROWTYPE;
  v_actor uuid := public.current_usuario_id();
BEGIN
  IF NOT public.measurement_actor_can_manage(p_obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar contratos desta obra' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT cliente_id INTO v_cliente FROM public.obras WHERE id = p_obra_id AND controle_medicoes_efetivo;
  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.obra_equipes WHERE obra_id = p_obra_id AND equipe_id = p_equipe_id) THEN
    RAISE EXCEPTION 'O empreiteiro não está vinculado a esta obra' USING ERRCODE = 'check_violation';
  END IF;
  IF NULLIF(trim(p_numero), '') IS NULL OR NULLIF(trim(p_objeto), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o número e o objeto do contrato' USING ERRCODE = 'check_violation';
  END IF;
  IF p_data_inicio IS NULL OR (p_data_fim IS NOT NULL AND p_data_fim < p_data_inicio) THEN
    RAISE EXCEPTION 'Datas do contrato inválidas' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contratos WHERE obra_id = p_obra_id AND lower(numero) = lower(trim(p_numero))
             AND id IS DISTINCT FROM p_contrato_id) THEN
    RAISE EXCEPTION 'Já existe um contrato com este número nesta obra' USING ERRCODE = 'unique_violation';
  END IF;

  IF p_contrato_id IS NULL THEN
    INSERT INTO public.contratos (cliente_id, obra_id, equipe_id, numero, objeto, valor_contratado, data_inicio, data_fim, observacao, criado_por)
    VALUES (v_cliente, p_obra_id, p_equipe_id, trim(p_numero), trim(p_objeto), p_valor_contratado, p_data_inicio, p_data_fim,
            NULLIF(trim(p_observacao), ''), v_actor)
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id FOR UPDATE;
    IF NOT FOUND OR c.obra_id <> p_obra_id THEN
      RAISE EXCEPTION 'Contrato não encontrado' USING ERRCODE = 'check_violation';
    END IF;
    IF c.equipe_id <> p_equipe_id AND (
         EXISTS (SELECT 1 FROM public.vinculos_execucao_servico WHERE contrato_id = c.id)
      OR EXISTS (SELECT 1 FROM public.medicoes_servico WHERE contrato_id = c.id)) THEN
      RAISE EXCEPTION 'O empreiteiro não pode mudar depois que o contrato tem serviços ou medições' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.contratos SET equipe_id = p_equipe_id, numero = trim(p_numero), objeto = trim(p_objeto),
      valor_contratado = p_valor_contratado, data_inicio = p_data_inicio, data_fim = p_data_fim,
      observacao = NULLIF(trim(p_observacao), ''), updated_at = now()
    WHERE id = c.id;
  END IF;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (v_cliente, p_obra_id, 'contrato', v_id, CASE WHEN p_contrato_id IS NULL THEN 'criado' ELSE 'atualizado' END,
          jsonb_build_object('numero', trim(p_numero), 'equipe', p_equipe_id, 'valor', p_valor_contratado), v_actor);
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.encerrar_contrato(p_contrato_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.contratos%ROWTYPE;
  v_actor uuid := public.current_usuario_id();
BEGIN
  SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(c.obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar este contrato' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'ativo' THEN
    RAISE EXCEPTION 'O contrato já está encerrado' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.medicoes_servico WHERE contrato_id = c.id AND status = 'rascunho') THEN
    RAISE EXCEPTION 'Aprove ou descarte os rascunhos de medição antes de encerrar' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.contratos SET status = 'encerrado', encerrado_em = now(), encerrado_por = v_actor,
    motivo_encerramento = NULLIF(trim(p_motivo), ''), updated_at = now()
  WHERE id = c.id;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (c.cliente_id, c.obra_id, 'contrato', c.id, 'encerrado', jsonb_build_object('motivo', p_motivo), v_actor);
END
$function$;

CREATE OR REPLACE FUNCTION public.reabrir_contrato(p_contrato_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.contratos%ROWTYPE;
  v_actor uuid := public.current_usuario_id();
BEGIN
  SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(c.obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para reabrir este contrato' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.contratos SET status = 'ativo', encerrado_em = NULL, encerrado_por = NULL, motivo_encerramento = NULL,
    updated_at = now()
  WHERE id = c.id;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, usuario_id)
  VALUES (c.cliente_id, c.obra_id, 'contrato', c.id, 'reaberto', v_actor);
END
$function$;

-- Contrato ativo que a pessoa pode gerenciar (usado pelas RPCs abaixo).
CREATE OR REPLACE FUNCTION public.contrato_gerenciavel(p_contrato_id uuid)
 RETURNS public.contratos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(c.obra_id) THEN
    RAISE EXCEPTION 'Sem permissão neste contrato' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'ativo' THEN
    RAISE EXCEPTION 'Contrato encerrado' USING ERRCODE = 'check_violation';
  END IF;
  RETURN c;
END
$function$;

CREATE OR REPLACE FUNCTION public.salvar_configuracao_medicao_contrato(
  p_contrato_id uuid, p_fvs_id uuid, p_metodo metodo_medicao_servico, p_unidade text, p_quantidade_total numeric,
  p_preco_unitario numeric, p_permite_parciais boolean, p_modelo_id uuid, p_etapas jsonb, p_data_inicio date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_id); v_id uuid;
BEGIN
  IF public.fvs_medicao_obra(p_fvs_id) IS DISTINCT FROM c.obra_id THEN
    RAISE EXCEPTION 'O serviço não é da obra do contrato' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.contrato_id', c.id::text, true);
  v_id := public.salvar_configuracao_medicao_fvs(p_fvs_id, p_metodo, p_unidade, p_quantidade_total, p_preco_unitario,
    p_permite_parciais, p_modelo_id, p_etapas, c.equipe_id, COALESCE(p_data_inicio, current_date));
  PERFORM set_config('app.contrato_id', '', true);
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.salvar_medicao_contrato(
  p_contrato_id uuid, p_medicao_id uuid, p_referencia text, p_periodo_inicio date, p_periodo_fim date,
  p_data_medicao date, p_observacao text, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_id); v_id uuid;
BEGIN
  IF p_medicao_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.medicoes_servico WHERE id = p_medicao_id AND contrato_id = c.id) THEN
    RAISE EXCEPTION 'A medição não é deste contrato' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.contrato_id', c.id::text, true);
  v_id := public.salvar_medicao_rascunho(p_medicao_id, c.obra_id, c.equipe_id, p_referencia, p_periodo_inicio,
    p_periodo_fim, p_data_medicao, p_observacao, p_itens);
  PERFORM set_config('app.contrato_id', '', true);
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.trocar_empreiteiro_contrato(
  p_vinculo_id uuid, p_contrato_destino_id uuid, p_data date, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_destino_id); v_id uuid;
BEGIN
  IF (SELECT public.fvs_medicao_obra(fvs_planejada_id) FROM public.vinculos_execucao_servico WHERE id = p_vinculo_id)
     IS DISTINCT FROM c.obra_id THEN
    RAISE EXCEPTION 'O contrato de destino é de outra obra' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.contrato_id', c.id::text, true);
  v_id := public.trocar_empreiteiro_servico(p_vinculo_id, c.equipe_id, p_data, p_motivo);
  PERFORM set_config('app.contrato_id', '', true);
  RETURN v_id;
END
$function$;

-- Resumo financeiro por contrato (RLS de quem consulta).
CREATE OR REPLACE VIEW public.vw_resumo_contratos WITH (security_invoker = true) AS
WITH servicos AS (
  SELECT v.contrato_id,
    count(DISTINCT v.fvs_planejada_id) AS servicos,
    sum(CASE WHEN v.status = 'ativo' THEN v.escopo_atribuido ELSE v.aprovado_congelado END
        * COALESCE(cfg.preco_unitario, 0))::numeric(18,2) AS valor_previsto
  FROM public.vinculos_execucao_servico v
  JOIN public.fvs_medicao_configuracoes cfg ON cfg.fvs_planejada_id = v.fvs_planejada_id
  WHERE v.contrato_id IS NOT NULL
  GROUP BY v.contrato_id
), saldos AS (
  SELECT v.contrato_id,
    sum(s.valor_disponivel)::numeric(18,2) AS valor_liberado,
    sum(s.valor_bloqueado)::numeric(18,2) AS valor_bloqueado
  FROM public.vw_saldos_medicao_servico s
  JOIN public.vinculos_execucao_servico v ON v.id = s.vinculacao_id
  WHERE v.contrato_id IS NOT NULL
  GROUP BY v.contrato_id
), medicoes AS (
  SELECT m.contrato_id,
    count(*) FILTER (WHERE m.status = 'aprovada') AS medicoes_aprovadas,
    count(*) FILTER (WHERE m.status = 'rascunho') AS rascunhos,
    max(m.data_medicao) FILTER (WHERE m.status = 'aprovada') AS ultima_medicao,
    COALESCE(sum(t.valor) FILTER (WHERE m.status = 'aprovada'), 0)::numeric(18,2) AS valor_medido,
    COALESCE(sum(t.valor) FILTER (WHERE m.status = 'rascunho'), 0)::numeric(18,2) AS valor_rascunho
  FROM public.medicoes_servico m
  LEFT JOIN LATERAL (SELECT sum(i.valor_calculado) AS valor FROM public.medicao_servico_itens i WHERE i.medicao_id = m.id) t ON true
  WHERE m.contrato_id IS NOT NULL
  GROUP BY m.contrato_id
)
SELECT c.id AS contrato_id, c.cliente_id, c.obra_id, c.equipe_id,
  COALESCE(s.servicos, 0)::integer AS servicos,
  COALESCE(s.valor_previsto, 0)::numeric(18,2) AS valor_previsto,
  COALESCE(c.valor_contratado, s.valor_previsto, 0)::numeric(18,2) AS valor_referencia,
  COALESCE(m.valor_medido, 0)::numeric(18,2) AS valor_medido,
  COALESCE(m.valor_rascunho, 0)::numeric(18,2) AS valor_rascunho,
  greatest(COALESCE(c.valor_contratado, s.valor_previsto, 0) - COALESCE(m.valor_medido, 0), 0)::numeric(18,2) AS valor_a_medir,
  COALESCE(sa.valor_liberado, 0)::numeric(18,2) AS valor_liberado,
  COALESCE(sa.valor_bloqueado, 0)::numeric(18,2) AS valor_bloqueado,
  COALESCE(m.medicoes_aprovadas, 0)::integer AS medicoes_aprovadas,
  COALESCE(m.rascunhos, 0)::integer AS rascunhos,
  m.ultima_medicao
FROM public.contratos c
LEFT JOIN servicos s ON s.contrato_id = c.id
LEFT JOIN saldos sa ON sa.contrato_id = c.id
LEFT JOIN medicoes m ON m.contrato_id = c.id;
REVOKE ALL ON public.vw_resumo_contratos FROM anon;
GRANT SELECT ON public.vw_resumo_contratos TO authenticated;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('salvar_contrato', 'encerrar_contrato', 'reabrir_contrato',
             'salvar_configuracao_medicao_contrato', 'salvar_medicao_contrato', 'trocar_empreiteiro_contrato') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('atribuir_contrato_medicao', 'validar_contrato_item_medicao',
             'contrato_gerenciavel') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
