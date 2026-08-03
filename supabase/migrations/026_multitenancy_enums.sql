-- Multitenancy SaaS: enums must be committed before the new enum value is used
-- by constraints and policies in the next migration.

ALTER TYPE perfil_usuario ADD VALUE IF NOT EXISTS 'superadmin' BEFORE 'admin';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_cliente') THEN
    CREATE TYPE status_cliente AS ENUM ('ativo', 'suspenso');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escopo_cadastro') THEN
    CREATE TYPE escopo_cadastro AS ENUM ('global', 'restrito');
  END IF;
END
$$;
