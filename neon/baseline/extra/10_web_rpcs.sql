-- Funções novas do Neon (não existiam no Supabase). Substituem os usos da service role no painel web.
-- Cada uma valida o chamador DENTRO do banco; o app não precisa mais de uma chave que ignore a RLS.

-- Antes: deleteObra() usava a service role porque obras não tem policy de DELETE.
CREATE OR REPLACE FUNCTION public.excluir_obra(p_obra_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente uuid;
  v_amb integer;
  v_usr integer;
  v_eq integer;
  v_del integer;
BEGIN
  IF get_perfil() IS DISTINCT FROM 'admin' OR NOT has_obra_access(p_obra_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta obra' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT cliente_id INTO v_cliente FROM obras WHERE id = p_obra_id;
  SELECT count(*) INTO v_amb FROM ambientes WHERE obra_id = p_obra_id AND cliente_id = v_cliente;
  SELECT count(*) INTO v_usr FROM obra_usuarios WHERE obra_id = p_obra_id AND cliente_id = v_cliente;
  SELECT count(*) INTO v_eq FROM obra_equipes WHERE obra_id = p_obra_id AND cliente_id = v_cliente;
  IF v_amb + v_usr + v_eq > 0 THEN
    RETURN jsonb_build_object('deleted', false, 'ambientes', v_amb, 'usuarios', v_usr, 'equipes', v_eq);
  END IF;
  DELETE FROM obras WHERE id = p_obra_id AND cliente_id = v_cliente;
  GET DIAGNOSTICS v_del = ROW_COUNT;
  RETURN jsonb_build_object('deleted', v_del > 0, 'ambientes', 0, 'usuarios', 0, 'equipes', 0);
END
$function$;

-- Antes: createCliente() usava a service role (clientes sem INSERT policy; usuarios de outro tenant;
-- auditoria_plataforma sem INSERT policy). A conta no Clerk é criada pelo servidor ANTES; aqui entra só o banco.
CREATE OR REPLACE FUNCTION public.plataforma_criar_cliente(
  p_nome text, p_slug text, p_contato_nome text, p_contato_email text, p_contato_telefone text,
  p_limite_usuarios integer, p_limite_empresas integer, p_limite_obras integer, p_admin_clerk_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente uuid;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à plataforma' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NULLIF(trim(p_admin_clerk_id), '') IS NULL THEN
    RAISE EXCEPTION 'Conta do administrador inicial não informada' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO clientes(nome, slug, contato_nome, contato_email, contato_telefone, limite_usuarios, limite_empresas, limite_obras)
  VALUES (p_nome, p_slug, NULLIF(p_contato_nome, ''), p_contato_email, NULLIF(p_contato_telefone, ''),
          p_limite_usuarios, p_limite_empresas, p_limite_obras)
  RETURNING id INTO v_cliente;
  INSERT INTO usuarios(cliente_id, nome, perfil, ativo, clerk_user_id, email, convite_enviado_em)
  VALUES (v_cliente, COALESCE(NULLIF(p_contato_nome, ''), p_nome), 'admin', true, p_admin_clerk_id,
          lower(p_contato_email), now());
  INSERT INTO auditoria_plataforma(ator_id, cliente_id, acao, detalhes)
  VALUES (current_usuario_id(), v_cliente, 'cliente_criado',
          jsonb_build_object('nome', p_nome, 'slug', p_slug, 'admin_email', p_contato_email));
  RETURN v_cliente;
END
$function$;

-- Antes: updateCliente() gravava a auditoria pela service role.
CREATE OR REPLACE FUNCTION public.plataforma_atualizar_cliente(
  p_id uuid, p_nome text, p_slug text, p_contato_nome text, p_contato_email text, p_contato_telefone text,
  p_limite_usuarios integer, p_limite_empresas integer, p_limite_obras integer, p_status status_cliente,
  p_detalhes jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à plataforma' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE clientes SET nome = p_nome, slug = p_slug, contato_nome = NULLIF(p_contato_nome, ''),
    contato_email = NULLIF(p_contato_email, ''), contato_telefone = NULLIF(p_contato_telefone, ''),
    limite_usuarios = p_limite_usuarios, limite_empresas = p_limite_empresas, limite_obras = p_limite_obras,
    status = p_status
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO auditoria_plataforma(ator_id, cliente_id, acao, detalhes)
  VALUES (current_usuario_id(), p_id,
          CASE WHEN p_status = 'suspenso' THEN 'cliente_suspenso' ELSE 'cliente_atualizado' END, p_detalhes);
END
$function$;

-- Antes: createUsuario() inseria em usuarios e depois em obra_usuarios; se o 2º passo falhava, o ON DELETE
-- CASCADE da FK para a tabela de usuários do Supabase limpava o 1º. Sem essa FK, o par precisa ser atômico. SECURITY INVOKER de propósito:
-- as policies de usuarios/obra_usuarios (admin do próprio cliente) continuam sendo a regra de acesso.
CREATE OR REPLACE FUNCTION public.criar_usuario(
  p_clerk_user_id text, p_email text, p_nome text, p_cargo text, p_perfil perfil_usuario, p_obras uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
  v_cliente uuid := get_cliente_id();
  v_obra uuid;
BEGIN
  INSERT INTO usuarios(clerk_user_id, email, cliente_id, nome, cargo, perfil, ativo)
  VALUES (p_clerk_user_id, lower(p_email), v_cliente, p_nome, NULLIF(p_cargo, ''), p_perfil, true)
  RETURNING id INTO v_id;
  IF p_perfil <> 'admin' THEN
    FOREACH v_obra IN ARRAY COALESCE(p_obras, ARRAY[]::uuid[]) LOOP
      INSERT INTO obra_usuarios(cliente_id, usuario_id, obra_id, papel, ativo)
      VALUES (v_cliente, v_id, v_obra, p_perfil::text, true);
    END LOOP;
  END IF;
  RETURN v_id;
END
$function$;
