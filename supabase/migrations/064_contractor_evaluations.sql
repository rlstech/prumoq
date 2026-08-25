-- Avaliações de fornecedores/empreiteiros. Os registros concluídos são
-- imutáveis e suas respostas preservam o texto e o peso da revisão utilizada.

DO $$ BEGIN
  CREATE TYPE public.status_avaliacao_empreiteiro AS ENUM ('rascunho', 'concluida', 'invalidada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.resultado_criterio_avaliacao AS ENUM ('atende', 'nao_atende');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.modelos_avaliacao_empreiteiro (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  empresa_id uuid REFERENCES public.empresas(id),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  descricao text,
  revisao_atual integer NOT NULL DEFAULT 0 CHECK (revisao_atual >= 0),
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS modelos_avaliacao_empreiteiro_global_nome_uidx
  ON public.modelos_avaliacao_empreiteiro(cliente_id, lower(nome)) WHERE empresa_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS modelos_avaliacao_empreiteiro_empresa_nome_uidx
  ON public.modelos_avaliacao_empreiteiro(cliente_id, empresa_id, lower(nome)) WHERE empresa_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.modelo_avaliacao_empreiteiro_revisoes (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  modelo_id uuid NOT NULL REFERENCES public.modelos_avaliacao_empreiteiro(id) ON DELETE CASCADE,
  numero_revisao integer NOT NULL CHECK (numero_revisao > 0),
  descricao_alteracoes text NOT NULL CHECK (length(trim(descricao_alteracoes)) > 0),
  publicado_por uuid NOT NULL REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(modelo_id, numero_revisao)
);

CREATE TABLE IF NOT EXISTS public.modelo_avaliacao_empreiteiro_criterios (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  revisao_id uuid NOT NULL REFERENCES public.modelo_avaliacao_empreiteiro_revisoes(id) ON DELETE CASCADE,
  ordem integer NOT NULL CHECK (ordem > 0),
  titulo text NOT NULL CHECK (length(trim(titulo)) > 0),
  peso smallint NOT NULL CHECK (peso BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(revisao_id, ordem)
);

CREATE TABLE IF NOT EXISTS public.avaliacoes_empreiteiro (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  equipe_id uuid NOT NULL REFERENCES public.equipes(id),
  medicao_id uuid REFERENCES public.medicoes_servico(id) ON DELETE SET NULL,
  modelo_revisao_id uuid NOT NULL REFERENCES public.modelo_avaliacao_empreiteiro_revisoes(id),
  data_avaliacao date NOT NULL DEFAULT current_date,
  notificacoes_ocorridas text,
  providencias_tomadas text,
  pontos_obtidos numeric(8,2) NOT NULL DEFAULT 0,
  pontos_possiveis numeric(8,2) NOT NULL DEFAULT 0,
  percentual numeric(6,2) NOT NULL DEFAULT 0,
  status public.status_avaliacao_empreiteiro NOT NULL DEFAULT 'rascunho',
  avaliador_id uuid NOT NULL REFERENCES public.usuarios(id),
  assinatura_url text,
  assinada_em timestamptz,
  concluida_em timestamptz,
  invalidada_por uuid REFERENCES public.usuarios(id),
  invalidada_em timestamptz,
  motivo_invalidacao text,
  created_offline boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'concluida') OR (assinatura_url IS NOT NULL AND assinada_em IS NOT NULL AND concluida_em IS NOT NULL)),
  CHECK ((status <> 'invalidada') OR (invalidada_por IS NOT NULL AND invalidada_em IS NOT NULL AND length(trim(coalesce(motivo_invalidacao,''))) >= 3))
);
CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_empreiteiro_medicao_ativa_uidx
  ON public.avaliacoes_empreiteiro(medicao_id) WHERE medicao_id IS NOT NULL AND status IN ('rascunho','concluida');
CREATE INDEX IF NOT EXISTS avaliacoes_empreiteiro_obra_data_idx ON public.avaliacoes_empreiteiro(obra_id, data_avaliacao DESC);

CREATE TABLE IF NOT EXISTS public.avaliacao_empreiteiro_itens (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes_empreiteiro(id) ON DELETE CASCADE,
  criterio_origem_id uuid REFERENCES public.modelo_avaliacao_empreiteiro_criterios(id),
  ordem integer NOT NULL CHECK (ordem > 0),
  titulo text NOT NULL CHECK (length(trim(titulo)) > 0),
  peso smallint NOT NULL CHECK (peso BETWEEN 1 AND 10),
  resultado public.resultado_criterio_avaliacao,
  comentario_nao_atende text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(avaliacao_id, ordem)
);

CREATE OR REPLACE FUNCTION public.avaliacao_empreiteiro_pode_editar(p_avaliacao_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a
    WHERE a.id=p_avaliacao_id AND a.status='rascunho' AND public.has_obra_access(a.obra_id)
      AND (a.avaliador_id=auth.uid() OR public.get_perfil() IN ('admin','gestor')))
$$;

CREATE OR REPLACE FUNCTION public.finalizar_avaliacao_empreiteiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_total numeric; v_obtido numeric; v_negativas integer;
BEGIN
  IF NEW.status='concluida' AND OLD.status='rascunho' THEN
    IF NEW.avaliador_id <> auth.uid() OR NEW.assinatura_url IS NULL OR NEW.assinada_em IS NULL THEN
      RAISE EXCEPTION 'Assinatura digital e avaliador são obrigatórios' USING ERRCODE='check_violation';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.equipes e WHERE e.id=NEW.equipe_id AND e.tipo='terceirizado' AND e.ativo)
      OR NOT EXISTS(SELECT 1 FROM public.obra_equipes oe WHERE oe.obra_id=NEW.obra_id AND oe.equipe_id=NEW.equipe_id) THEN
      RAISE EXCEPTION 'Selecione um empreiteiro ativo vinculado à obra' USING ERRCODE='check_violation';
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.modelo_avaliacao_empreiteiro_revisoes r
      JOIN public.modelos_avaliacao_empreiteiro mo ON mo.id=r.modelo_id
      JOIN public.obras o ON o.id=NEW.obra_id
      WHERE r.id=NEW.modelo_revisao_id AND mo.cliente_id=NEW.cliente_id
        AND (mo.empresa_id IS NULL OR mo.empresa_id=o.empresa_id)
    ) THEN
      RAISE EXCEPTION 'O modelo de avaliação não está disponível para esta obra' USING ERRCODE='check_violation';
    END IF;
    SELECT coalesce(sum(i.peso),0), coalesce(sum(CASE WHEN i.resultado='atende' THEN i.peso ELSE 0 END),0),
      count(*) FILTER (WHERE i.resultado='nao_atende')
    INTO v_total, v_obtido, v_negativas
    FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NOT NULL;
    IF v_total=0 OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NULL)
      OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado='nao_atende' AND length(trim(coalesce(i.comentario_nao_atende,'')))=0) THEN
      RAISE EXCEPTION 'Responda todos os critérios e justifique cada não atendimento' USING ERRCODE='check_violation';
    END IF;
    IF v_negativas > 0 AND length(trim(coalesce(NEW.providencias_tomadas,'')))=0 THEN
      RAISE EXCEPTION 'Providências tomadas são obrigatórias quando há não atendimento' USING ERRCODE='check_violation';
    END IF;
    NEW.pontos_possiveis:=v_total; NEW.pontos_obtidos:=v_obtido;
    NEW.percentual:=round((v_obtido/nullif(v_total,0))*100,2); NEW.concluida_em:=coalesce(NEW.concluida_em,now()); NEW.updated_at:=now();
  ELSIF OLD.status='concluida' AND NEW.status='invalidada' THEN
    -- A RLS permite esta transição somente pela RPC administrativa de invalidação.
    NULL;
  ELSIF OLD.status IN ('concluida','invalidada') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Avaliação concluída ou invalidada não pode ser alterada diretamente' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_finalizar_avaliacao_empreiteiro ON public.avaliacoes_empreiteiro;
CREATE TRIGGER trg_finalizar_avaliacao_empreiteiro BEFORE UPDATE ON public.avaliacoes_empreiteiro FOR EACH ROW EXECUTE FUNCTION public.finalizar_avaliacao_empreiteiro();

CREATE OR REPLACE FUNCTION public.publicar_modelo_avaliacao_empreiteiro(
  p_modelo_id uuid, p_empresa_id uuid, p_nome text, p_descricao text, p_ativo boolean,
  p_descricao_alteracoes text, p_criterios jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cliente uuid:=public.get_cliente_id(); v_modelo uuid:=coalesce(p_modelo_id,public.uuid_generate_v4()); v_revisao integer; v_item jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.get_perfil()<>'admin' OR v_cliente IS NULL THEN RAISE EXCEPTION 'Somente administradores podem publicar modelos' USING ERRCODE='insufficient_privilege'; END IF;
  IF nullif(trim(p_nome),'') IS NULL OR nullif(trim(p_descricao_alteracoes),'') IS NULL OR jsonb_typeof(p_criterios)<>'array' OR jsonb_array_length(p_criterios)=0 THEN RAISE EXCEPTION 'Nome, alterações e critérios são obrigatórios' USING ERRCODE='check_violation'; END IF;
  IF p_empresa_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.empresas e WHERE e.id=p_empresa_id AND e.cliente_id=v_cliente) THEN RAISE EXCEPTION 'Empresa fora do escopo' USING ERRCODE='insufficient_privilege'; END IF;
  INSERT INTO public.modelos_avaliacao_empreiteiro(id,cliente_id,empresa_id,nome,descricao,ativo,criado_por)
  VALUES(v_modelo,v_cliente,p_empresa_id,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),p_ativo,auth.uid())
  ON CONFLICT(id) DO UPDATE SET empresa_id=excluded.empresa_id,nome=excluded.nome,descricao=excluded.descricao,ativo=excluded.ativo,updated_at=now()
  WHERE public.modelos_avaliacao_empreiteiro.cliente_id=v_cliente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado' USING ERRCODE='no_data_found'; END IF;
  SELECT revisao_atual+1 INTO v_revisao FROM public.modelos_avaliacao_empreiteiro WHERE id=v_modelo FOR UPDATE;
  INSERT INTO public.modelo_avaliacao_empreiteiro_revisoes(cliente_id,modelo_id,numero_revisao,descricao_alteracoes,publicado_por)
  VALUES(v_cliente,v_modelo,v_revisao,trim(p_descricao_alteracoes),auth.uid()) RETURNING id INTO v_modelo;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_criterios) LOOP
    INSERT INTO public.modelo_avaliacao_empreiteiro_criterios(cliente_id,revisao_id,ordem,titulo,peso)
    VALUES(v_cliente,v_modelo,(v_item->>'ordem')::integer,trim(v_item->>'titulo'),(v_item->>'peso')::smallint);
  END LOOP;
  UPDATE public.modelos_avaliacao_empreiteiro SET revisao_atual=v_revisao,updated_at=now() WHERE id=(SELECT modelo_id FROM public.modelo_avaliacao_empreiteiro_revisoes WHERE id=v_modelo);
  RETURN v_modelo;
END $$;

CREATE OR REPLACE FUNCTION public.invalidar_avaliacao_empreiteiro(p_avaliacao_id uuid,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.avaliacoes_empreiteiro%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.avaliacoes_empreiteiro WHERE id=p_avaliacao_id FOR UPDATE;
  IF NOT FOUND OR public.get_perfil()<>'admin' OR NOT public.has_obra_access(a.obra_id) OR a.status<>'concluida' OR length(trim(coalesce(p_motivo,'')))<3 THEN RAISE EXCEPTION 'Invalidação não permitida' USING ERRCODE='check_violation'; END IF;
  IF a.medicao_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.medicoes_servico m WHERE m.id=a.medicao_id AND m.status='aprovada') THEN RAISE EXCEPTION 'Cancele a medição antes de invalidar a avaliação' USING ERRCODE='check_violation'; END IF;
  UPDATE public.avaliacoes_empreiteiro SET status='invalidada',invalidada_por=auth.uid(),invalidada_em=now(),motivo_invalidacao=trim(p_motivo),updated_at=now() WHERE id=a.id;
END $$;

ALTER TABLE public.modelos_avaliacao_empreiteiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelo_avaliacao_empreiteiro_revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelo_avaliacao_empreiteiro_criterios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes_empreiteiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_empreiteiro_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY modelos_avaliacao_empreiteiro_select ON public.modelos_avaliacao_empreiteiro FOR SELECT USING (public.has_cliente_access(cliente_id));
CREATE POLICY revisoes_avaliacao_empreiteiro_select ON public.modelo_avaliacao_empreiteiro_revisoes FOR SELECT USING (public.has_cliente_access(cliente_id));
CREATE POLICY criterios_avaliacao_empreiteiro_select ON public.modelo_avaliacao_empreiteiro_criterios FOR SELECT USING (public.has_cliente_access(cliente_id));
CREATE POLICY avaliacoes_empreiteiro_select ON public.avaliacoes_empreiteiro FOR SELECT USING (public.has_obra_access(obra_id));
CREATE POLICY avaliacoes_empreiteiro_insert ON public.avaliacoes_empreiteiro FOR INSERT WITH CHECK (public.has_obra_access(obra_id) AND avaliador_id=auth.uid() AND status='rascunho' AND public.get_perfil() IN ('admin','gestor','inspetor'));
CREATE POLICY avaliacoes_empreiteiro_update ON public.avaliacoes_empreiteiro FOR UPDATE USING (public.avaliacao_empreiteiro_pode_editar(id)) WITH CHECK (public.has_obra_access(obra_id) AND avaliador_id=auth.uid());
CREATE POLICY itens_avaliacao_empreiteiro_select ON public.avaliacao_empreiteiro_itens FOR SELECT USING (EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a WHERE a.id=avaliacao_id AND public.has_obra_access(a.obra_id)));
CREATE POLICY itens_avaliacao_empreiteiro_write ON public.avaliacao_empreiteiro_itens FOR ALL USING (public.avaliacao_empreiteiro_pode_editar(avaliacao_id)) WITH CHECK (public.avaliacao_empreiteiro_pode_editar(avaliacao_id));

REVOKE ALL ON FUNCTION public.publicar_modelo_avaliacao_empreiteiro(uuid,uuid,text,text,boolean,text,jsonb),public.invalidar_avaliacao_empreiteiro(uuid,text),public.finalizar_avaliacao_empreiteiro() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publicar_modelo_avaliacao_empreiteiro(uuid,uuid,text,text,boolean,text,jsonb),public.invalidar_avaliacao_empreiteiro(uuid,text) TO authenticated;

-- A assinatura segue a mesma validação de chaves R2 privadas das inspeções.
DROP TRIGGER IF EXISTS trg_avaliacoes_empreiteiro_media_reference ON public.avaliacoes_empreiteiro;
CREATE TRIGGER trg_avaliacoes_empreiteiro_media_reference
BEFORE INSERT OR UPDATE ON public.avaliacoes_empreiteiro
FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_media_reference();
