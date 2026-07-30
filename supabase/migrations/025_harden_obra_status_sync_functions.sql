-- As funcoes abaixo sao internas aos triggers. O Supabase concede EXECUTE
-- explicitamente a anon/authenticated, portanto revogar apenas de PUBLIC nao
-- impede que sejam expostas como RPC.

REVOKE ALL ON FUNCTION public.sync_obra_status_from_fvs(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_obra_status_after_fvs_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_obra_status_after_ambiente_change()
  FROM PUBLIC, anon, authenticated;
