-- Aditivos de contrato: incluir serviços e mudar quantidade ou preço dos itens, com registro de quem fez. Idempotente.
-- O aditivo vale na hora. Medições já aprovadas não mudam (os itens guardam preço e valor do momento da medição).
-- O valor do contrato muda pela diferença dos itens: Σ(qtd nova × preço novo − qtd antiga × preço antigo).

CREATE TABLE IF NOT EXISTS public.contrato_aditivos (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id),
  numero integer NOT NULL,
  descricao text NOT NULL,
  data date NOT NULL DEFAULT current_date,
  valor_anterior numeric(18,2) NOT NULL,
  valor_novo numeric(18,2) NOT NULL,
  criado_por uuid REFERENCES public.usuarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contrato_aditivos_numero_check CHECK (numero > 0),
  CONSTRAINT contrato_aditivos_descricao_check CHECK (length(trim(descricao)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS contrato_aditivos_numero_uidx ON public.contrato_aditivos (contrato_id, numero);

CREATE TABLE IF NOT EXISTS public.contrato_aditivo_itens (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  aditivo_id uuid NOT NULL REFERENCES public.contrato_aditivos(id),
  fvs_planejada_id uuid NOT NULL REFERENCES public.fvs_planejadas(id),
  tipo text NOT NULL,
  unidade text NOT NULL,
  quantidade_anterior numeric(18,6) NOT NULL,
  quantidade_nova numeric(18,6) NOT NULL,
  preco_anterior numeric(18,4),
  preco_novo numeric(18,4),
  CONSTRAINT contrato_aditivo_itens_tipo_check CHECK (tipo IN ('inclusao', 'alteracao'))
);
CREATE INDEX IF NOT EXISTS contrato_aditivo_itens_aditivo_idx ON public.contrato_aditivo_itens (aditivo_id);

ALTER TABLE public.contrato_aditivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_aditivo_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contrato_aditivos_read ON public.contrato_aditivos;
CREATE POLICY contrato_aditivos_read ON public.contrato_aditivos AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
DROP POLICY IF EXISTS contrato_aditivo_itens_read ON public.contrato_aditivo_itens;
CREATE POLICY contrato_aditivo_itens_read ON public.contrato_aditivo_itens AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
REVOKE ALL ON public.contrato_aditivos, public.contrato_aditivo_itens FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.contrato_aditivos, public.contrato_aditivo_itens FROM authenticated;
GRANT SELECT ON public.contrato_aditivos, public.contrato_aditivo_itens TO authenticated;
DROP TRIGGER IF EXISTS trg_contrato_aditivos_cliente_guard ON public.contrato_aditivos;
CREATE TRIGGER trg_contrato_aditivos_cliente_guard BEFORE INSERT OR UPDATE OF cliente_id ON public.contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cliente_id();
DROP TRIGGER IF EXISTS trg_contrato_aditivo_itens_cliente_guard ON public.contrato_aditivo_itens;
CREATE TRIGGER trg_contrato_aditivo_itens_cliente_guard BEFORE INSERT OR UPDATE OF cliente_id ON public.contrato_aditivo_itens
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cliente_id();

CREATE OR REPLACE FUNCTION public.aplicar_aditivo_contrato(p_contrato_id uuid, p_descricao text, p_data date, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.contratos%ROWTYPE := public.contrato_gerenciavel(p_contrato_id);
  v_actor uuid := public.current_usuario_id();
  v_id uuid := public.uuid_generate_v4();
  v_data date := COALESCE(p_data, current_date);
  v_numero integer;
  v_item jsonb;
  v_fvs uuid;
  v_nome text;
  v_metodo public.metodo_medicao_servico;
  cfg public.fvs_medicao_configuracoes%ROWTYPE;
  v_link public.vinculos_execucao_servico%ROWTYPE;
  v_qa numeric; v_qn numeric; v_pa numeric; v_pn numeric; v_aprovado numeric;
  v_delta numeric := 0;
  v_anterior numeric;
  v_novo numeric;
  v_n integer := 0;
BEGIN
  IF NULLIF(trim(p_descricao), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do aditivo' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Inclua ao menos um item no aditivo' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.contratos WHERE id = c.id FOR UPDATE;
  SELECT COALESCE(max(numero), 0) + 1 INTO v_numero FROM public.contrato_aditivos WHERE contrato_id = c.id;
  SELECT COALESCE(c.valor_contratado, r.valor_previsto, 0) INTO v_anterior FROM public.vw_resumo_contratos r WHERE r.contrato_id = c.id;
  v_anterior := COALESCE(v_anterior, c.valor_contratado, 0);

  INSERT INTO public.contrato_aditivos (id, cliente_id, obra_id, contrato_id, numero, descricao, data, valor_anterior, valor_novo, criado_por)
  VALUES (v_id, c.cliente_id, c.obra_id, c.id, v_numero, trim(p_descricao), v_data, v_anterior, v_anterior, v_actor);
  PERFORM set_config('app.aditivo_id', v_id::text, true);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_fvs := (v_item->>'fvs_id')::uuid;
    SELECT subservico INTO v_nome FROM public.fvs_planejadas WHERE id = v_fvs;
    v_nome := COALESCE(v_nome, 'serviço');

    IF COALESCE((v_item->>'novo')::boolean, false) THEN
      -- Inclusão de serviço novo no contrato.
      v_metodo := COALESCE(v_item->>'metodo', 'quantidade')::public.metodo_medicao_servico;
      IF v_metodo NOT IN ('quantidade', 'unidade_concluida') THEN
        RAISE EXCEPTION 'No aditivo, inclua % por quantidade ou unidade concluída', v_nome USING ERRCODE = 'check_violation';
      END IF;
      IF EXISTS (SELECT 1 FROM public.fvs_medicao_configuracoes WHERE fvs_planejada_id = v_fvs) THEN
        RAISE EXCEPTION '% já tem medição configurada', v_nome USING ERRCODE = 'check_violation';
      END IF;
      v_qn := CASE WHEN v_metodo = 'unidade_concluida' THEN 1 ELSE NULLIF(v_item->>'quantidade', '')::numeric END;
      v_pn := NULLIF(v_item->>'preco', '')::numeric;
      IF v_qn IS NULL OR v_qn <= 0 OR COALESCE(v_pn, 0) < 0 THEN
        RAISE EXCEPTION 'Quantidade ou preço inválido em %', v_nome USING ERRCODE = 'check_violation';
      END IF;
      PERFORM public.salvar_configuracao_medicao_contrato(c.id, v_fvs, v_metodo,
        CASE WHEN v_metodo = 'unidade_concluida' THEN 'un' ELSE COALESCE(NULLIF(trim(v_item->>'unidade'), ''), 'un') END,
        v_qn, v_pn, v_metodo <> 'unidade_concluida', NULL, '[]'::jsonb, v_data);
      PERFORM set_config('app.aditivo_id', v_id::text, true);
      INSERT INTO public.contrato_aditivo_itens (cliente_id, obra_id, aditivo_id, fvs_planejada_id, tipo, unidade,
        quantidade_anterior, quantidade_nova, preco_anterior, preco_novo)
      VALUES (c.cliente_id, c.obra_id, v_id, v_fvs, 'inclusao',
        CASE WHEN v_metodo = 'unidade_concluida' THEN 'un' ELSE COALESCE(NULLIF(trim(v_item->>'unidade'), ''), 'un') END,
        0, v_qn, NULL, v_pn);
      v_delta := v_delta + v_qn * COALESCE(v_pn, 0);
      v_n := v_n + 1;
      CONTINUE;
    END IF;

    -- Alteração de item existente.
    SELECT * INTO cfg FROM public.fvs_medicao_configuracoes WHERE fvs_planejada_id = v_fvs FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.vinculos_execucao_servico WHERE fvs_planejada_id = v_fvs AND contrato_id = c.id) THEN
      RAISE EXCEPTION '% não faz parte deste contrato', v_nome USING ERRCODE = 'check_violation';
    END IF;
    SELECT COALESCE(sum(CASE WHEN status = 'ativo' THEN escopo_atribuido ELSE aprovado_congelado END), 0) INTO v_qa
      FROM public.vinculos_execucao_servico WHERE fvs_planejada_id = v_fvs AND contrato_id = c.id;
    v_pa := cfg.preco_unitario;
    v_qn := COALESCE(NULLIF(v_item->>'quantidade', '')::numeric, v_qa);
    v_pn := CASE WHEN v_item ? 'preco' THEN NULLIF(v_item->>'preco', '')::numeric ELSE v_pa END;
    IF v_pn IS NOT NULL AND v_pn < 0 THEN
      RAISE EXCEPTION 'Preço inválido em %', v_nome USING ERRCODE = 'check_violation';
    END IF;
    IF v_qn = v_qa AND v_pn IS NOT DISTINCT FROM v_pa THEN
      CONTINUE;
    END IF;

    IF v_qn <> v_qa THEN
      IF cfg.metodo <> 'quantidade' THEN
        RAISE EXCEPTION 'Em %, só o preço pode mudar (serviço medido por unidade ou etapas)', v_nome USING ERRCODE = 'check_violation';
      END IF;
      SELECT * INTO v_link FROM public.vinculos_execucao_servico
        WHERE fvs_planejada_id = v_fvs AND contrato_id = c.id AND status = 'ativo' FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION '% não tem responsável ativo neste contrato', v_nome USING ERRCODE = 'check_violation';
      END IF;
      SELECT COALESCE(max(aprovado_atual), 0) INTO v_aprovado FROM public.avancos_aprovados_servico WHERE vinculacao_id = v_link.id;
      IF v_link.escopo_atribuido + (v_qn - v_qa) <= 0 OR v_link.escopo_atribuido + (v_qn - v_qa) < v_aprovado THEN
        RAISE EXCEPTION 'A quantidade de % não pode ficar abaixo do já aprovado em campo (% %)',
          v_nome, trim(to_char(v_qa - v_link.escopo_atribuido + v_aprovado, 'FM999999999990.######')), cfg.unidade
          USING ERRCODE = 'check_violation';
      END IF;
      UPDATE public.vinculos_execucao_servico SET escopo_atribuido = escopo_atribuido + (v_qn - v_qa), updated_at = now()
        WHERE id = v_link.id;
      UPDATE public.fvs_medicao_configuracoes SET quantidade_total = quantidade_total + (v_qn - v_qa),
        updated_by = v_actor, updated_at = now() WHERE id = cfg.id;
    END IF;
    IF v_pn IS DISTINCT FROM v_pa THEN
      UPDATE public.fvs_medicao_configuracoes SET preco_unitario = v_pn, updated_by = v_actor, updated_at = now() WHERE id = cfg.id;
    END IF;
    INSERT INTO public.contrato_aditivo_itens (cliente_id, obra_id, aditivo_id, fvs_planejada_id, tipo, unidade,
      quantidade_anterior, quantidade_nova, preco_anterior, preco_novo)
    VALUES (c.cliente_id, c.obra_id, v_id, v_fvs, 'alteracao', cfg.unidade, v_qa, v_qn, v_pa, v_pn);
    v_delta := v_delta + v_qn * COALESCE(v_pn, 0) - v_qa * COALESCE(v_pa, 0);
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'Nenhum item mudou: altere quantidade ou preço, ou inclua um serviço' USING ERRCODE = 'check_violation';
  END IF;
  v_novo := round(v_anterior + v_delta, 2);
  UPDATE public.contrato_aditivos SET valor_novo = v_novo WHERE id = v_id;
  UPDATE public.contratos SET
    valor_contratado = CASE WHEN valor_contratado IS NULL THEN NULL ELSE v_novo END,
    updated_at = now(), updated_by = v_actor
  WHERE id = c.id;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (c.cliente_id, c.obra_id, 'contrato', c.id, 'aditivo',
    jsonb_build_object('aditivo', v_id, 'numero', v_numero, 'valor_anterior', v_anterior, 'valor_novo', v_novo, 'itens', v_n), v_actor);
  PERFORM set_config('app.aditivo_id', '', true);
  RETURN v_id;
END
$function$;

-- Quantidade ou preço mudados fora de um aditivo (ou da configuração pelo contrato) ficam registrados com o autor.
CREATE OR REPLACE FUNCTION public.registrar_alteracao_config_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (NEW.quantidade_total, NEW.preco_unitario) IS NOT DISTINCT FROM (OLD.quantidade_total, OLD.preco_unitario) THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.aditivo_id', true), '') <> '' OR COALESCE(current_setting('app.contrato_id', true), '') <> '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.auditoria_operacional (cliente_id, obra_id, entidade, entidade_id, acao, dados, usuario_id)
  VALUES (NEW.cliente_id, public.fvs_medicao_obra(NEW.fvs_planejada_id), 'fvs_medicao_configuracao', NEW.id, 'alterada_fora_de_aditivo',
    jsonb_build_object('quantidade_anterior', OLD.quantidade_total, 'quantidade_nova', NEW.quantidade_total,
      'preco_anterior', OLD.preco_unitario, 'preco_novo', NEW.preco_unitario), public.current_usuario_id());
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_registrar_alteracao_config ON public.fvs_medicao_configuracoes;
CREATE TRIGGER trg_registrar_alteracao_config AFTER UPDATE ON public.fvs_medicao_configuracoes
  FOR EACH ROW EXECUTE FUNCTION registrar_alteracao_config_medicao();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'aplicar_aditivo_contrato' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'registrar_alteracao_config_medicao' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
