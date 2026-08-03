-- Restringe funcoes SECURITY DEFINER legadas ao menor conjunto de papeis
-- necessario. Funcoes de trigger nao precisam de EXECUTE para os papeis que
-- gravam nas tabelas; o PostgreSQL as executa por meio do proprio trigger.

REVOKE ALL ON FUNCTION public.apply_fvs_conclusao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_fvs_reabertura() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_fvs_lifecycle_status(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_fvs_status() FROM PUBLIC, anon, authenticated;

-- RPCs e helpers usados por sessoes autenticadas. Remover PUBLIC e anon evita
-- que uma requisicao sem sessao alcance funcoes que contornam RLS internamente.
REVOKE ALL ON FUNCTION public.get_fvs_attachments(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_obras_acesso() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_usuarios_com_obras() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_verificacoes_fvs(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_fvs_attachments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_obras_acesso() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usuarios_com_obras() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_verificacoes_fvs(uuid) TO authenticated;
