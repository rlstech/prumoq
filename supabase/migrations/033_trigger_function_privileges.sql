-- Follow-up for projects where Supabase default privileges had already granted
-- trigger functions to PUBLIC before migration 032 was applied.

REVOKE ALL ON FUNCTION enforce_cliente_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION validate_resource_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_row_cliente_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION validate_cliente_limits() FROM PUBLIC, anon, authenticated;
