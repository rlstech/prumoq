-- Forward-only correction for environments where 067/068 and the initial
-- reopening migration have already been deployed.

ALTER TABLE public.avaliacoes_empreiteiro
  ADD COLUMN IF NOT EXISTS ultimo_motivo_reabertura text;

ALTER TABLE public.avaliacao_empreiteiro_reaberturas
  ADD COLUMN IF NOT EXISTS avaliador_anterior_id uuid REFERENCES public.usuarios(id);
UPDATE public.avaliacao_empreiteiro_reaberturas r
SET avaliador_anterior_id = a.avaliador_id
FROM public.avaliacoes_empreiteiro a
WHERE a.id = r.avaliacao_id AND r.avaliador_anterior_id IS NULL;
ALTER TABLE public.avaliacao_empreiteiro_reaberturas
  ALTER COLUMN avaliador_anterior_id SET NOT NULL;

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
    IF NOT public.avaliacao_empreiteiro_pode_reabrir(OLD.id)
      OR length(trim(coalesce(NEW.ultimo_motivo_reabertura,''))) < 3 THEN
      RAISE EXCEPTION 'Reabertura não permitida' USING ERRCODE='check_violation';
    END IF;
    SELECT count(*)+1 INTO v_reabertura
    FROM public.avaliacao_empreiteiro_reaberturas WHERE avaliacao_id=OLD.id;
    INSERT INTO public.avaliacao_empreiteiro_reaberturas
      (cliente_id,avaliacao_id,avaliador_anterior_id,reaberto_por,motivo,numero_reabertura)
    VALUES
      (OLD.cliente_id,OLD.id,OLD.avaliador_id,auth.uid(),trim(NEW.ultimo_motivo_reabertura),v_reabertura);
    NEW.assinatura_url:=NULL; NEW.assinada_em:=NULL; NEW.concluida_em:=NULL;
    NEW.pontos_obtidos:=0; NEW.pontos_possiveis:=0; NEW.percentual:=0; NEW.updated_at:=now();
  ELSIF NEW.status='concluida' AND OLD.status='rascunho' THEN
    NEW.avaliador_id:=auth.uid();
    IF NEW.assinatura_url IS NULL OR NEW.assinada_em IS NULL THEN
      RAISE EXCEPTION 'Assinatura digital é obrigatória' USING ERRCODE='check_violation';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.equipes e WHERE e.id=NEW.equipe_id AND e.tipo='terceirizado' AND e.ativo)
      OR NOT EXISTS(SELECT 1 FROM public.obra_equipes oe WHERE oe.obra_id=NEW.obra_id AND oe.equipe_id=NEW.equipe_id) THEN
      RAISE EXCEPTION 'Selecione um empreiteiro ativo vinculado à obra' USING ERRCODE='check_violation';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.modelo_avaliacao_empreiteiro_revisoes r
      JOIN public.modelos_avaliacao_empreiteiro mo ON mo.id=r.modelo_id
      JOIN public.obras o ON o.id=NEW.obra_id
      WHERE r.id=NEW.modelo_revisao_id AND mo.cliente_id=NEW.cliente_id
        AND (mo.empresa_id IS NULL OR mo.empresa_id=o.empresa_id)) THEN
      RAISE EXCEPTION 'O modelo de avaliação não está disponível para esta obra' USING ERRCODE='check_violation';
    END IF;
    SELECT coalesce(sum(i.peso),0),coalesce(sum(CASE WHEN i.resultado='atende' THEN i.peso ELSE 0 END),0),
      count(*) FILTER (WHERE i.resultado='nao_atende')
    INTO v_total,v_obtido,v_negativas
    FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NOT NULL;
    IF v_total=0 OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado IS NULL)
      OR EXISTS(SELECT 1 FROM public.avaliacao_empreiteiro_itens i WHERE i.avaliacao_id=NEW.id AND i.resultado='nao_atende' AND length(trim(coalesce(i.comentario_nao_atende,'')))=0) THEN
      RAISE EXCEPTION 'Responda todos os critérios e justifique cada não atendimento' USING ERRCODE='check_violation';
    END IF;
    IF v_negativas>0 AND length(trim(coalesce(NEW.providencias_tomadas,'')))=0 THEN
      RAISE EXCEPTION 'Providências tomadas são obrigatórias quando há não atendimento' USING ERRCODE='check_violation';
    END IF;
    NEW.pontos_possiveis:=v_total; NEW.pontos_obtidos:=v_obtido;
    NEW.percentual:=round((v_obtido/nullif(v_total,0))*100,2);
    NEW.concluida_em:=coalesce(NEW.concluida_em,now()); NEW.updated_at:=now();
  ELSIF OLD.status='concluida' AND NEW.status IN ('aprovada','invalidada') THEN
    NULL;
  ELSIF OLD.status IN ('concluida','aprovada','invalidada') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Avaliação concluída, aprovada ou invalidada não pode ser alterada diretamente' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reabrir_avaliacao_empreiteiro(p_avaliacao_id uuid,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.avaliacoes_empreiteiro
  SET status='rascunho',ultimo_motivo_reabertura=trim(p_motivo),updated_at=now()
  WHERE id=p_avaliacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reabertura não permitida' USING ERRCODE='check_violation'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.avaliacao_empreiteiro_pode_reabrir(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reabrir_avaliacao_empreiteiro(uuid,text) TO authenticated;
