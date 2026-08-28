-- Approval and reopening lifecycle. 067 deliberately contains only the enum
-- addition, so the new value is committed before this migration uses it.

ALTER TABLE public.avaliacoes_empreiteiro
  ADD COLUMN IF NOT EXISTS aprovada_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS aprovada_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_motivo_reabertura text;

-- The legacy trigger predates the approved state.  Disable it only while
-- normalizing historical rows; the replacement trigger below is re-enabled
-- for all subsequent writes.
ALTER TABLE public.avaliacoes_empreiteiro DISABLE TRIGGER trg_finalizar_avaliacao_empreiteiro;
UPDATE public.avaliacoes_empreiteiro
SET status = 'aprovada', aprovada_em = coalesce(aprovada_em, concluida_em)
WHERE status = 'concluida';
ALTER TABLE public.avaliacoes_empreiteiro ENABLE TRIGGER trg_finalizar_avaliacao_empreiteiro;

DROP INDEX IF EXISTS public.avaliacoes_empreiteiro_medicao_ativa_uidx;
CREATE UNIQUE INDEX avaliacoes_empreiteiro_medicao_ativa_uidx
  ON public.avaliacoes_empreiteiro(medicao_id)
  WHERE medicao_id IS NOT NULL AND status IN ('rascunho', 'concluida', 'aprovada');

CREATE TABLE IF NOT EXISTS public.avaliacao_empreiteiro_reaberturas (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes_empreiteiro(id) ON DELETE CASCADE,
  avaliador_anterior_id uuid NOT NULL REFERENCES public.usuarios(id),
  reaberto_por uuid NOT NULL REFERENCES public.usuarios(id),
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 3),
  numero_reabertura integer NOT NULL CHECK (numero_reabertura > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS avaliacao_empreiteiro_reaberturas_avaliacao_idx
  ON public.avaliacao_empreiteiro_reaberturas(avaliacao_id);
ALTER TABLE public.avaliacao_empreiteiro_reaberturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avaliacao_empreiteiro_reaberturas_select ON public.avaliacao_empreiteiro_reaberturas;
CREATE POLICY avaliacao_empreiteiro_reaberturas_select ON public.avaliacao_empreiteiro_reaberturas
  FOR SELECT USING (EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a WHERE a.id=avaliacao_id AND public.has_obra_access(a.obra_id)));

CREATE OR REPLACE FUNCTION public.avaliacao_empreiteiro_pode_editar(p_avaliacao_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a
    WHERE a.id=p_avaliacao_id AND a.status='rascunho' AND public.has_obra_access(a.obra_id)
      AND (a.avaliador_id=auth.uid() OR public.get_perfil() IN ('admin','gestor')))
$$;

CREATE OR REPLACE FUNCTION public.avaliacao_empreiteiro_pode_reabrir(p_avaliacao_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a
    WHERE a.id=p_avaliacao_id AND a.status='concluida' AND public.has_obra_access(a.obra_id)
      AND (a.avaliador_id=auth.uid() OR public.get_perfil() IN ('admin','gestor')))
$$;

DROP POLICY IF EXISTS avaliacoes_empreiteiro_update ON public.avaliacoes_empreiteiro;
CREATE POLICY avaliacoes_empreiteiro_update ON public.avaliacoes_empreiteiro FOR UPDATE
  USING (public.avaliacao_empreiteiro_pode_editar(id) OR public.avaliacao_empreiteiro_pode_reabrir(id))
  WITH CHECK (public.has_obra_access(obra_id) AND (avaliador_id=auth.uid() OR public.get_perfil() IN ('admin','gestor')));

CREATE OR REPLACE FUNCTION public.finalizar_avaliacao_empreiteiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_total numeric; v_obtido numeric; v_negativas integer; v_reabertura integer;
BEGIN
  IF OLD.status='concluida' AND NEW.status='rascunho' THEN
    IF NOT public.avaliacao_empreiteiro_pode_reabrir(OLD.id) OR length(trim(coalesce(NEW.ultimo_motivo_reabertura,''))) < 3 THEN
      RAISE EXCEPTION 'Reabertura não permitida' USING ERRCODE='check_violation';
    END IF;
    SELECT count(*)+1 INTO v_reabertura FROM public.avaliacao_empreiteiro_reaberturas WHERE avaliacao_id=OLD.id;
    INSERT INTO public.avaliacao_empreiteiro_reaberturas (cliente_id,avaliacao_id,avaliador_anterior_id,reaberto_por,motivo,numero_reabertura)
    VALUES (OLD.cliente_id,OLD.id,OLD.avaliador_id,auth.uid(),trim(NEW.ultimo_motivo_reabertura),v_reabertura);
    NEW.assinatura_url:=NULL; NEW.assinada_em:=NULL; NEW.concluida_em:=NULL;
    NEW.pontos_obtidos:=0; NEW.pontos_possiveis:=0; NEW.percentual:=0; NEW.updated_at:=now();
  ELSIF NEW.status='concluida' AND OLD.status='rascunho' THEN
    NEW.avaliador_id:=auth.uid();
    IF NEW.assinatura_url IS NULL OR NEW.assinada_em IS NULL THEN RAISE EXCEPTION 'Assinatura digital é obrigatória' USING ERRCODE='check_violation'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.equipes e WHERE e.id=NEW.equipe_id AND e.tipo='terceirizado' AND e.ativo)
      OR NOT EXISTS(SELECT 1 FROM public.obra_equipes oe WHERE oe.obra_id=NEW.obra_id AND oe.equipe_id=NEW.equipe_id) THEN RAISE EXCEPTION 'Selecione um empreiteiro ativo vinculado à obra' USING ERRCODE='check_violation'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.modelo_avaliacao_empreiteiro_revisoes r JOIN public.modelos_avaliacao_empreiteiro mo ON mo.id=r.modelo_id JOIN public.obras o ON o.id=NEW.obra_id WHERE r.id=NEW.modelo_revisao_id AND mo.cliente_id=NEW.cliente_id AND (mo.empresa_id IS NULL OR mo.empresa_id=o.empresa_id)) THEN RAISE EXCEPTION 'O modelo de avaliação não está disponível para esta obra' USING ERRCODE='check_violation'; END IF;
    SELECT coalesce(sum(i.peso),0),coalesce(sum(CASE WHEN i.resultado='atende' THEN i.peso ELSE 0 END),0),count(*) FILTER (WHERE i.resultado='nao_atende') INTO v_total,v_obtido,v_negativas FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NOT NULL;
    IF v_total=0 OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NULL) OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado='nao_atende' AND length(trim(coalesce(i.comentario_nao_atende,'')))=0) THEN RAISE EXCEPTION 'Responda todos os critérios e justifique cada não atendimento' USING ERRCODE='check_violation'; END IF;
    IF v_negativas>0 AND length(trim(coalesce(NEW.providencias_tomadas,'')))=0 THEN RAISE EXCEPTION 'Providências tomadas são obrigatórias quando há não atendimento' USING ERRCODE='check_violation'; END IF;
    NEW.pontos_possiveis:=v_total; NEW.pontos_obtidos:=v_obtido; NEW.percentual:=round((v_obtido/nullif(v_total,0))*100,2); NEW.concluida_em:=coalesce(NEW.concluida_em,now()); NEW.updated_at:=now();
  ELSIF OLD.status='concluida' AND NEW.status IN ('aprovada','invalidada') THEN
    NULL;
  ELSIF OLD.status IN ('concluida','aprovada','invalidada') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Avaliação concluída, aprovada ou invalidada não pode ser alterada diretamente' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.aprovar_avaliacao_empreiteiro(p_avaliacao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.avaliacoes_empreiteiro%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.avaliacoes_empreiteiro WHERE id=p_avaliacao_id FOR UPDATE;
  IF NOT FOUND OR public.get_perfil() NOT IN ('admin','gestor') OR NOT public.has_obra_access(a.obra_id) OR a.status<>'concluida' THEN RAISE EXCEPTION 'Aprovação não permitida' USING ERRCODE='check_violation'; END IF;
  UPDATE public.avaliacoes_empreiteiro SET status='aprovada',aprovada_por=auth.uid(),aprovada_em=now(),updated_at=now() WHERE id=a.id;
END $$;

CREATE OR REPLACE FUNCTION public.invalidar_avaliacao_empreiteiro(p_avaliacao_id uuid,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.avaliacoes_empreiteiro%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.avaliacoes_empreiteiro WHERE id=p_avaliacao_id FOR UPDATE;
  IF NOT FOUND OR public.get_perfil() NOT IN ('admin','gestor') OR NOT public.has_obra_access(a.obra_id) OR a.status<>'concluida' OR length(trim(coalesce(p_motivo,'')))<3 THEN RAISE EXCEPTION 'Invalidação não permitida' USING ERRCODE='check_violation'; END IF;
  UPDATE public.avaliacoes_empreiteiro SET status='invalidada',invalidada_por=auth.uid(),invalidada_em=now(),motivo_invalidacao=trim(p_motivo),updated_at=now() WHERE id=a.id;
END $$;

CREATE OR REPLACE FUNCTION public.reabrir_avaliacao_empreiteiro(p_avaliacao_id uuid,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.avaliacoes_empreiteiro SET status='rascunho',ultimo_motivo_reabertura=trim(p_motivo),updated_at=now() WHERE id=p_avaliacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reabertura não permitida' USING ERRCODE='check_violation'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.aprovar_medicao_servico(p_medicao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.medicoes_servico%ROWTYPE; item record; saldo record; actor uuid:=auth.uid(); v_terceirizado boolean;
BEGIN
  SELECT * INTO m FROM public.medicoes_servico WHERE id=p_medicao_id FOR UPDATE;
  IF NOT FOUND OR NOT public.measurement_actor_can_manage(m.obra_id) THEN RAISE EXCEPTION 'Sem permissão para aprovar medição' USING ERRCODE='insufficient_privilege'; END IF;
  IF m.status<>'rascunho' THEN RAISE EXCEPTION 'Somente medições em rascunho podem ser aprovadas' USING ERRCODE='check_violation'; END IF;
  IF NOT (SELECT controle_medicoes_efetivo FROM public.obras WHERE id=m.obra_id) THEN RAISE EXCEPTION 'Controle de medições desabilitado nesta obra' USING ERRCODE='check_violation'; END IF;
  SELECT tipo='terceirizado' INTO v_terceirizado FROM public.equipes WHERE id=m.equipe_id;
  IF coalesce(v_terceirizado,false) AND NOT EXISTS(SELECT 1 FROM public.avaliacoes_empreiteiro a WHERE a.medicao_id=m.id AND a.status='aprovada' AND a.obra_id=m.obra_id AND a.equipe_id=m.equipe_id) THEN RAISE EXCEPTION 'Aprovar a avaliação do empreiteiro antes de aprovar esta medição' USING ERRCODE='check_violation'; END IF;
  FOR item IN SELECT i.* FROM public.medicao_servico_itens i WHERE i.medicao_id=m.id ORDER BY i.vinculacao_id FOR UPDATE LOOP
    PERFORM 1 FROM public.vinculos_execucao_servico WHERE id=item.vinculacao_id FOR UPDATE;
    IF item.tipo='avanco' THEN
      SELECT * INTO saldo FROM public.saldo_vinculo_execucao(item.vinculacao_id);
      IF item.quantidade_periodo>saldo.disponivel THEN RAISE EXCEPTION 'Quantidade medida excede saldo aprovado disponível' USING ERRCODE='serialization_failure'; END IF;
      IF item.quantidade_periodo<>(SELECT coalesce(sum(l.quantidade_utilizada),0) FROM public.medicao_item_liberacoes l WHERE l.medicao_item_id=item.id AND l.ativa) THEN RAISE EXCEPTION 'As alocações não correspondem à quantidade medida' USING ERRCODE='check_violation'; END IF;
    END IF;
  END LOOP;
  UPDATE public.medicoes_servico SET status='aprovada',aprovado_por=actor,aprovado_em=now(),updated_at=now() WHERE id=m.id;
  INSERT INTO public.auditoria_operacional(cliente_id,obra_id,entidade,entidade_id,acao,usuario_id) VALUES(m.cliente_id,m.obra_id,'medicao',m.id,'aprovada',actor);
END $$;

REVOKE ALL ON FUNCTION public.aprovar_avaliacao_empreiteiro(uuid),public.invalidar_avaliacao_empreiteiro(uuid,text),public.reabrir_avaliacao_empreiteiro(uuid,text),public.avaliacao_empreiteiro_pode_reabrir(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.aprovar_avaliacao_empreiteiro(uuid),public.invalidar_avaliacao_empreiteiro(uuid,text),public.reabrir_avaliacao_empreiteiro(uuid,text) TO authenticated;
