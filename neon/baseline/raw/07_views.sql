CREATE OR REPLACE VIEW public.fvs_padrao_itens_current WITH (security_invoker=true) AS  SELECT fi.id,
    fi.fvs_padrao_id,
    fi.revisao,
    fi.ordem,
    fi.titulo,
    fi.metodo_verif,
    fi.tolerancia,
    fi.created_at
   FROM (fvs_padrao_itens fi
     JOIN fvs_padrao fp ON ((fi.fvs_padrao_id = fp.id)))
  WHERE (fi.revisao = fp.revisao_atual);

CREATE OR REPLACE VIEW public.v_obras_com_fvs WITH (security_invoker=true) AS  SELECT o.id,
    o.nome,
    o.status,
    o.endereco,
    o.municipio,
    o.uf,
    o.eng_responsavel AS engenheiro_nome,
    o.crea_cau AS engenheiro_crea,
    e.nome AS empresa_nome,
    count(DISTINCT a.id) AS total_ambientes,
    count(DISTINCT f.id) AS total_fvs,
    count(DISTINCT
        CASE
            WHEN (f.status = ANY (ARRAY['conforme'::status_fvs, 'concluida'::status_fvs, 'concluida_ressalva'::status_fvs])) THEN f.id
            ELSE NULL::uuid
        END) AS fvs_concluidas,
    COALESCE((((count(DISTINCT
        CASE
            WHEN (f.status = ANY (ARRAY['conforme'::status_fvs, 'concluida'::status_fvs, 'concluida_ressalva'::status_fvs])) THEN f.id
            ELSE NULL::uuid
        END))::double precision * (100.0)::double precision) / (NULLIF(count(DISTINCT f.id), 0))::double precision), (0)::double precision) AS progresso_percentual,
    ( SELECT count(*) AS count
           FROM (((nao_conformidades n
             JOIN verificacoes v ON ((v.id = n.verificacao_id)))
             JOIN fvs_planejadas fp2 ON ((fp2.id = v.fvs_planejada_id)))
             JOIN ambientes a2 ON ((a2.id = fp2.ambiente_id)))
          WHERE ((a2.obra_id = o.id) AND (a2.ativo = true) AND (n.status = ANY (ARRAY['aberta'::status_nc, 'em_correcao'::status_nc])))) AS ncs_abertas
   FROM (((obras o
     LEFT JOIN empresas e ON ((e.id = o.empresa_id)))
     LEFT JOIN ambientes a ON (((a.obra_id = o.id) AND (a.ativo = true))))
     LEFT JOIN fvs_planejadas f ON ((f.ambiente_id = a.id)))
  WHERE (o.ativo = true)
  GROUP BY o.id, e.nome
  ORDER BY o.nome;

CREATE OR REPLACE VIEW public.vw_saldos_medicao_servico WITH (security_invoker=true) AS  SELECT v.id AS vinculacao_id,
    v.cliente_id,
    fvs_medicao_obra(v.fvs_planejada_id) AS obra_id,
    v.fvs_planejada_id,
    v.etapa_id,
    v.equipe_id,
    v.escopo_atribuido,
    s.aprovado,
    s.medido,
    s.bloqueado,
    s.disponivel,
    c.unidade,
    c.preco_unitario,
    ((s.disponivel * COALESCE(c.preco_unitario, (0)::numeric)))::numeric(18,4) AS valor_disponivel,
    ((s.medido * COALESCE(c.preco_unitario, (0)::numeric)))::numeric(18,4) AS valor_medido,
    ((s.bloqueado * COALESCE(c.preco_unitario, (0)::numeric)))::numeric(18,4) AS valor_bloqueado
   FROM ((vinculos_execucao_servico v
     JOIN fvs_medicao_configuracoes c ON ((c.fvs_planejada_id = v.fvs_planejada_id)))
     CROSS JOIN LATERAL saldo_vinculo_execucao(v.id) s(aprovado, medido, bloqueado, disponivel));

CREATE OR REPLACE VIEW public.vw_indicadores_medicoes WITH (security_invoker=true) AS  WITH saldos AS (
         SELECT vw_saldos_medicao_servico.obra_id,
            (sum(vw_saldos_medicao_servico.disponivel))::numeric(18,6) AS quantidade_disponivel,
            (sum(vw_saldos_medicao_servico.valor_disponivel))::numeric(18,4) AS valor_disponivel,
            (sum(vw_saldos_medicao_servico.medido))::numeric(18,6) AS quantidade_medida,
            (sum(vw_saldos_medicao_servico.bloqueado))::numeric(18,6) AS quantidade_bloqueada,
            (sum(vw_saldos_medicao_servico.valor_medido))::numeric(18,4) AS valor_medido,
            (sum(vw_saldos_medicao_servico.valor_bloqueado))::numeric(18,4) AS valor_bloqueado
           FROM vw_saldos_medicao_servico
          GROUP BY vw_saldos_medicao_servico.obra_id
        ), custos AS (
         SELECT nc_obra(nao_conformidades.id) AS obra_id,
            (sum(nao_conformidades.valor_estimado) FILTER (WHERE (nao_conformidades.situacao_financeira = 'estimado'::situacao_impacto_financeiro_nc)))::numeric(18,4) AS custo_estimado_retrabalho,
            (sum(nao_conformidades.valor_confirmado) FILTER (WHERE (nao_conformidades.situacao_financeira = 'confirmado'::situacao_impacto_financeiro_nc)))::numeric(18,4) AS custo_confirmado_retrabalho
           FROM nao_conformidades
          GROUP BY (nc_obra(nao_conformidades.id))
        )
 SELECT o.id AS obra_id,
    (COALESCE(s.quantidade_disponivel, (0)::numeric))::numeric(18,6) AS quantidade_disponivel,
    (COALESCE(s.valor_disponivel, (0)::numeric))::numeric(18,4) AS valor_disponivel,
    (COALESCE(s.quantidade_medida, (0)::numeric))::numeric(18,6) AS quantidade_medida,
    (COALESCE(s.quantidade_bloqueada, (0)::numeric))::numeric(18,6) AS quantidade_bloqueada,
    (COALESCE(c.custo_estimado_retrabalho, (0)::numeric))::numeric(18,4) AS custo_estimado_retrabalho,
    (COALESCE(c.custo_confirmado_retrabalho, (0)::numeric))::numeric(18,4) AS custo_confirmado_retrabalho,
    (COALESCE(s.valor_medido, (0)::numeric))::numeric(18,4) AS valor_medido,
    (COALESCE(s.valor_bloqueado, (0)::numeric))::numeric(18,4) AS valor_bloqueado
   FROM ((obras o
     LEFT JOIN saldos s ON ((s.obra_id = o.id)))
     LEFT JOIN custos c ON ((c.obra_id = o.id)));
