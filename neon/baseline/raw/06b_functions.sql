CREATE OR REPLACE FUNCTION public.get_accessible_media_keys(p_keys text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT key FROM (
    SELECT vf.r2_key AS key FROM verificacao_fotos vf WHERE vf.r2_key = ANY(p_keys)
    UNION SELECT vf.r2_thumb_key FROM verificacao_fotos vf WHERE vf.r2_thumb_key = ANY(p_keys)
    UNION SELECT nf.r2_key FROM nc_fotos nf WHERE nf.r2_key = ANY(p_keys)
    UNION SELECT nf.r2_thumb_key FROM nc_fotos nf WHERE nf.r2_thumb_key = ANY(p_keys)
    UNION SELECT v.assinatura_url FROM verificacoes v WHERE v.assinatura_url = ANY(p_keys)
    UNION SELECT fc.assinatura_url FROM fvs_conclusoes fc WHERE fc.assinatura_url = ANY(p_keys)
    UNION SELECT nr.foto_url FROM nc_reinspecoes nr WHERE nr.foto_url = ANY(p_keys)
    UNION SELECT nc.foto_reinspecao_url FROM nao_conformidades nc WHERE nc.foto_reinspecao_url = ANY(p_keys)
    UNION SELECT u.assinatura_padrao_url FROM usuarios u
      WHERE u.id = auth.uid() AND u.assinatura_padrao_url = ANY(p_keys)
    UNION SELECT ae.assinatura_url FROM avaliacoes_empreiteiro ae
      WHERE ae.assinatura_url = ANY(p_keys)
  ) media WHERE key IS NOT NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ambientes_obra(p_obra_id uuid)
 RETURNS TABLE(id uuid, nome text, tipo text, localizacao text, total_fvs bigint, fvs_concluidas bigint, ncs_abertas bigint, progresso_percentual double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_cliente_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT u.cliente_id FROM usuarios u
  WHERE u.id = auth.uid() AND u.ativo = true
$function$
;

-- NEON-TODO: referencia auth.users (invited_at, email) -> redesenhar para Clerk
CREATE OR REPLACE FUNCTION public.get_clientes_resumo()
 RETURNS TABLE(id uuid, nome text, slug text, status status_cliente, contato_nome text, contato_email text, contato_telefone text, limite_usuarios integer, limite_empresas integer, limite_obras integer, usuarios_ativos bigint, empresas_ativas bigint, obras_ativas bigint, admin_onboarding_status text, admin_convite_enviado_em timestamp with time zone, admin_onboarding_concluido_em timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à plataforma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nome,
    c.slug,
    c.status,
    c.contato_nome,
    c.contato_email,
    c.contato_telefone,
    c.limite_usuarios,
    c.limite_empresas,
    c.limite_obras,
    (SELECT count(*) FROM public.usuarios u WHERE u.cliente_id = c.id AND u.ativo),
    (SELECT count(*) FROM public.empresas e WHERE e.cliente_id = c.id AND e.ativo),
    (SELECT count(*) FROM public.obras o WHERE o.cliente_id = c.id AND o.ativo),
    CASE
      WHEN admin_info.usuario_id IS NULL THEN 'sem_administrador'
      WHEN admin_info.onboarding_concluido_em IS NULL THEN 'aguardando_ativacao'
      ELSE 'ativado'
    END,
    admin_info.invited_at,
    admin_info.onboarding_concluido_em,
    c.created_at
  FROM public.clientes c
  LEFT JOIN LATERAL (
    SELECT
      u.id AS usuario_id,
      u.onboarding_concluido_em,
      au.invited_at
    FROM public.usuarios u
    JOIN auth.users au ON au.id = u.id
    WHERE u.cliente_id = c.id
      AND u.perfil = 'admin'
    ORDER BY
      (lower(au.email) = lower(c.contato_email)) DESC,
      u.created_at ASC
    LIMIT 1
  ) AS admin_info ON true
  ORDER BY c.nome;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fotos_fvs(p_fvs_id uuid)
 RETURNS TABLE(id uuid, verificacao_id uuid, r2_key text, ordem integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT id, verificacao_id, r2_key, ordem
  FROM verificacao_fotos
  WHERE verificacao_id IN (
    SELECT id FROM verificacoes WHERE fvs_planejada_id = p_fvs_id
  )
  ORDER BY verificacao_id, ordem;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_ambiente(p_ambiente_id uuid)
 RETURNS TABLE(id uuid, subservico text, status text, total_verificacoes bigint, ultima_verif date, ncs_abertas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_attachments(p_fvs_id uuid)
 RETURNS TABLE(id uuid, verificacao_id uuid, r2_key text, ordem integer, kind text, label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH target_fvs AS (
    SELECT fp.id FROM fvs_planejadas fp
    WHERE fp.id = p_fvs_id AND has_fvs_access(fp.id)
  ),
  report_verifications AS (
    SELECT v.id FROM verificacoes v
    JOIN target_fvs tf ON tf.id = v.fvs_planejada_id
  ),
  report_ncs AS (
    SELECT nc.id, nc.verificacao_id, nc.descricao, nc.foto_reinspecao_url
    FROM nao_conformidades nc
    JOIN report_verifications rv ON rv.id = nc.verificacao_id
  )
  SELECT vf.id, vf.verificacao_id, vf.r2_key, vf.ordem,
    'verification'::text, U&'Evid\00EAncia da verifica\00E7\00E3o'::text
  FROM verificacao_fotos vf JOIN report_verifications rv ON rv.id = vf.verificacao_id
  UNION ALL
  SELECT nf.id, nc.verificacao_id, nf.r2_key, nf.ordem,
    'nc'::text, U&'N\00E3o conformidade: ' || left(nc.descricao, 100)
  FROM nc_fotos nf JOIN report_ncs nc ON nc.id = nf.nc_id
  UNION ALL
  SELECT nr.id, nc.verificacao_id, nr.foto_url, 0,
    'reinspection'::text, U&'Reinspe\00E7\00E3o da n\00E3o conformidade'::text
  FROM nc_reinspecoes nr JOIN report_ncs nc ON nc.id = nr.nc_id
  WHERE nr.foto_url IS NOT NULL
  UNION ALL
  SELECT nc.id, nc.verificacao_id, nc.foto_reinspecao_url, 0,
    'reinspection'::text, U&'Reinspe\00E7\00E3o da n\00E3o conformidade'::text
  FROM report_ncs nc
  WHERE nc.foto_reinspecao_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM nc_reinspecoes nr
      WHERE nr.nc_id = nc.id AND nr.foto_url = nc.foto_reinspecao_url
    )
  ORDER BY 2, 5, 4, 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_detalhe(p_fvs_id uuid)
 RETURNS TABLE(id uuid, subservico text, status text, ambiente_nome text, obra_nome text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT fp.id, fp.subservico, fp.status,
         a.nome AS ambiente_nome, o.nome AS obra_nome
  FROM fvs_planejadas fp
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o     ON o.id = a.obra_id
  WHERE fp.id = p_fvs_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fvs_header(p_fvs_id uuid)
 RETURNS TABLE(obra_nome text, obra_municipio text, obra_uf text, obra_endereco text, obra_eng_responsavel text, obra_crea_cau text, empresa_nome text, ambiente_nome text, ambiente_tipo text, ambiente_localizacao text, fvs_subservico text, fvs_status text, fvs_revisao text, fvs_concluida_em timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT
    o.nome, o.municipio, o.uf, o.endereco,
    o.eng_responsavel, o.crea_cau,
    e.nome,
    a.nome, a.tipo::text, a.localizacao,
    fp.subservico, fp.status::text, fp.revisao_associada::text, fp.concluida_em
  FROM fvs_planejadas fp
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o ON o.id = a.obra_id
  LEFT JOIN empresas e ON e.id = o.empresa_id
  WHERE fp.id = p_fvs_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_itens_checklist(p_fvs_id uuid)
 RETURNS TABLE(id uuid, ordem integer, titulo text, metodo_verif text, tolerancia text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT fpi.id, fpi.ordem, fpi.titulo, fpi.metodo_verif, fpi.tolerancia
  FROM fvs_padrao_itens fpi
  JOIN fvs_planejadas fp ON fp.fvs_padrao_id = fpi.fvs_padrao_id
    AND fpi.revisao = fp.revisao_associada
  WHERE fp.id = p_fvs_id
  ORDER BY fpi.ordem;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_abertas_inspetor(p_inspetor_id uuid)
 RETURNS TABLE(count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT COUNT(*) AS count
  FROM nao_conformidades n
  JOIN verificacoes v ON v.id = n.verificacao_id
  WHERE v.inspetor_id = p_inspetor_id AND n.status = 'aberta';
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_full()
 RETURNS TABLE(id uuid, descricao text, status text, data_nova_verif date, prioridade text, item_titulo text, ambiente_nome text, obra_nome text, responsavel_nome text, fvs_planejada_id uuid, obra_id uuid, ambiente_id uuid, prazo_correcao date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT n.id, n.descricao, n.status, n.data_nova_verif, n.prioridade,
         vi.titulo AS item_titulo,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         e.nome AS responsavel_nome,
         fp.id AS fvs_planejada_id,
         o.id AS obra_id, a.id AS ambiente_id,
         n.data_nova_verif AS prazo_correcao
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v        ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp     ON fp.id = v.fvs_planejada_id
  JOIN ambientes a           ON a.id = fp.ambiente_id
  JOIN obras o               ON o.id = a.obra_id
  LEFT JOIN equipes e        ON e.id = n.responsavel_id
  WHERE n.status != 'cancelada'
  ORDER BY n.data_nova_verif ASC NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_fvs(p_fvs_id uuid)
 RETURNS TABLE(id uuid, verificacao_id uuid, descricao text, solucao_proposta text, data_nova_verif date, status text, item_titulo text, responsavel_nome text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT n.id, n.verificacao_id, n.descricao, n.solucao_proposta,
         n.data_nova_verif, n.status, vi.titulo AS item_titulo,
         e.nome AS responsavel_nome
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  LEFT JOIN equipes e       ON e.id = n.responsavel_id
  WHERE n.verificacao_id IN (
    SELECT id FROM verificacoes WHERE fvs_planejada_id = p_fvs_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_ncs_urgentes()
 RETURNS TABLE(id uuid, item_titulo text, descricao text, ambiente_nome text, obra_nome text, subservico text, prioridade text, equipe_nome text, data_nova_verif date, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT n.id, vi.titulo AS item_titulo, n.descricao,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         fp.subservico,
         n.prioridade,
         eq.nome AS equipe_nome,
         n.data_nova_verif,
         n.status::text
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v        ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp     ON fp.id = v.fvs_planejada_id
  JOIN ambientes a           ON a.id = fp.ambiente_id
  JOIN obras o               ON o.id = a.obra_id
  LEFT JOIN equipes eq       ON eq.id = n.responsavel_id
  WHERE n.status IN ('aberta', 'em_correcao')
  ORDER BY n.data_nova_verif ASC NULLS LAST
  LIMIT 5;
$function$
;

CREATE OR REPLACE FUNCTION public.get_obra_kpi(p_obra_id uuid)
 RETURNS TABLE(total_ambientes bigint, total_fvs bigint, fvs_concluidas bigint, ncs_abertas bigint, progresso_percentual double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_obras_acesso()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select obra_id from obra_usuarios
  where usuario_id = auth.uid() and ativo = true
$function$
;

CREATE OR REPLACE FUNCTION public.get_obras_com_fvs()
 RETURNS TABLE(id uuid, nome text, status text, endereco text, municipio text, uf text, engenheiro_nome text, engenheiro_crea text, empresa_nome text, total_ambientes bigint, total_fvs bigint, fvs_concluidas bigint, progresso_percentual double precision, ncs_abertas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT id, nome, status, endereco, municipio, uf,
         engenheiro_nome, engenheiro_crea, empresa_nome,
         total_ambientes, total_fvs, fvs_concluidas,
         progresso_percentual, ncs_abertas
  FROM v_obras_com_fvs;
$function$
;

CREATE OR REPLACE FUNCTION public.get_obras_progresso_dashboard()
 RETURNS TABLE(id uuid, nome text, status text, municipio text, uf text, empresa_nome text, total_ambientes bigint, total_fvs bigint, fvs_concluidas bigint, progresso_percentual double precision, ncs_abertas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_perfil()
 RETURNS perfil_usuario
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT u.perfil FROM usuarios u
  WHERE u.id = auth.uid() AND u.ativo = true
$function$
;

-- NEON-TODO: referencia auth.users (email, last_sign_in_at) -> redesenhar para Clerk
CREATE OR REPLACE FUNCTION public.get_usuarios_com_obras()
 RETURNS TABLE(id uuid, nome text, email character varying, perfil text, cargo text, ativo boolean, obras_acesso jsonb, ultimo_acesso timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF public.get_perfil() NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado. Requer perfil admin ou gestor.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.nome,
    au.email::varchar,
    u.perfil::text,
    u.cargo,
    u.ativo,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome))
        FROM obra_usuarios ou
        JOIN obras o ON o.id = ou.obra_id
        WHERE ou.usuario_id = u.id
      ),
      '[]'::jsonb
    ) AS obras_acesso,
    au.last_sign_in_at
  FROM public.usuarios u
  JOIN auth.users au ON au.id = u.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_verificacoes_fvs(p_fvs_id uuid)
 RETURNS TABLE(id uuid, numero_verif integer, data_verif date, status text, observacoes text, assinatura_url text, percentual_exec integer, created_offline boolean, inspetor_nome text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT v.id, v.numero_verif, v.data_verif, v.status,
         v.observacoes, v.assinatura_url, v.percentual_exec,
         v.created_offline, u.nome AS inspetor_nome,
         v.created_at
  FROM verificacoes v
  LEFT JOIN usuarios u ON u.id = v.inspetor_id
  WHERE v.fvs_planejada_id = p_fvs_id
  ORDER BY v.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_verificacoes_recentes()
 RETURNS TABLE(id uuid, status text, data_verif date, ambiente_nome text, obra_nome text, fvs_nome text, fvs_planejada_id uuid, ambiente_id uuid, obra_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
    SELECT v.id, v.status, v.data_verif,
           a.nome AS ambiente_nome, o.nome AS obra_nome,
           fp.subservico AS fvs_nome,
           fp.id AS fvs_planejada_id,
           a.id  AS ambiente_id,
           o.id  AS obra_id
    FROM verificacoes v
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a        ON a.id = fp.ambiente_id
    JOIN obras o            ON o.id = a.obra_id
    ORDER BY v.data_verif DESC
    LIMIT 3;
  $function$
;

CREATE OR REPLACE FUNCTION public.has_ambiente_access(p_ambiente_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM ambientes a
    WHERE a.id = p_ambiente_id AND has_obra_access(a.obra_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.has_cliente_access(p_cliente_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    JOIN clientes c ON c.id = u.cliente_id
    WHERE u.id = auth.uid() AND u.ativo = true
      AND c.status = 'ativo' AND u.cliente_id = p_cliente_id
  )
$function$
;
