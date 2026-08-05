-- Supabase installs uuid-ossp in the `extensions` schema. Measurement RPCs use a
-- restricted search_path, so expose the UUID v4 function in `public` explicitly.
-- This preserves existing table defaults and already-applied RPC definitions.
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
VOLATILE
PARALLEL SAFE
SET search_path = extensions, pg_temp
AS $$
  SELECT extensions.uuid_generate_v4()
$$;

REVOKE ALL ON FUNCTION public.uuid_generate_v4() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uuid_generate_v4() TO authenticated, service_role;

COMMENT ON FUNCTION public.uuid_generate_v4() IS
  'Compatibility wrapper for uuid-ossp when application RPCs use search_path public, pg_temp.';
