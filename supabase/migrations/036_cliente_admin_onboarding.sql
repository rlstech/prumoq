-- Separa o estado operacional do cliente do onboarding do administrador inicial.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS onboarding_concluido_em timestamptz;

-- Contas anteriores ao fluxo de convite já estavam operacionais. Convites
-- continuam pendentes até que o usuário defina a primeira senha.
UPDATE public.usuarios AS u
SET onboarding_concluido_em = COALESCE(au.email_confirmed_at, u.created_at)
FROM auth.users AS au
WHERE au.id = u.id
  AND au.invited_at IS NULL
  AND u.onboarding_concluido_em IS NULL;

CREATE OR REPLACE FUNCTION public.concluir_onboarding()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_concluido_em timestamptz;
BEGIN
  UPDATE public.usuarios
  SET
    onboarding_concluido_em = COALESCE(onboarding_concluido_em, now()),
    updated_at = now()
  WHERE id = auth.uid()
    AND perfil = 'admin'
    AND ativo = true
  RETURNING onboarding_concluido_em INTO v_concluido_em;

  IF v_concluido_em IS NULL THEN
    RAISE EXCEPTION 'Administrador ativo não encontrado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN v_concluido_em;
END;
$$;

REVOKE ALL ON FUNCTION public.concluir_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_onboarding() TO authenticated;

DROP FUNCTION IF EXISTS public.get_clientes_resumo();

CREATE FUNCTION public.get_clientes_resumo()
RETURNS TABLE (
  id uuid,
  nome text,
  slug text,
  status status_cliente,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  limite_usuarios integer,
  limite_empresas integer,
  limite_obras integer,
  usuarios_ativos bigint,
  empresas_ativas bigint,
  obras_ativas bigint,
  admin_onboarding_status text,
  admin_convite_enviado_em timestamptz,
  admin_onboarding_concluido_em timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_clientes_resumo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_clientes_resumo() TO authenticated;
