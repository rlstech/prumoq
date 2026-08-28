-- Trigger functions are internal implementation details and must not be
-- callable through PostgREST RPC by authenticated clients.
REVOKE ALL ON FUNCTION public.protect_usuario_self_service_fields() FROM PUBLIC, anon, authenticated;
