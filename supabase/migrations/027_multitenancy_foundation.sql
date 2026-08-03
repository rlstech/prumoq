-- PrumoQ SaaS multitenancy foundation.
-- This migration intentionally targets a clean/reset database. Existing production
-- rows must be migrated to a client before applying it to a populated database.

CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status status_cliente NOT NULL DEFAULT 'ativo',
  contato_nome text,
  contato_email text,
  contato_telefone text,
  limite_usuarios integer CHECK (limite_usuarios IS NULL OR limite_usuarios > 0),
  limite_empresas integer CHECK (limite_empresas IS NULL OR limite_empresas > 0),
  limite_obras integer CHECK (limite_obras IS NULL OR limite_obras > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auditoria_plataforma (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve installations that already contain operational data. Everything
-- that predates SaaS becomes the first tenant and can be renamed afterwards.
INSERT INTO clientes (nome, slug)
SELECT 'Ambiente legado', 'ambiente-legado'
WHERE EXISTS (
  SELECT 1 FROM usuarios
  UNION ALL SELECT 1 FROM empresas
  UNION ALL SELECT 1 FROM obras
  LIMIT 1
);

-- Policies from the single-company model reference columns that are removed
-- below, so they must be dropped before the column transformation.
DO $$
DECLARE policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'empresas', 'usuarios', 'obras', 'obra_usuarios', 'obra_equipes',
        'equipes', 'fvs_padrao', 'fvs_padrao_revisoes', 'fvs_padrao_itens',
        'ambientes', 'fvs_planejadas', 'verificacoes', 'verificacao_itens',
        'verificacao_fotos', 'nao_conformidades', 'nc_fotos', 'nc_reinspecoes',
        'fvs_conclusoes', 'fvs_reaberturas'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  END LOOP;
END
$$;

-- The old usuarios.empresa_id mixed the SaaS account and legal company concepts.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_empresa_id_fkey;
ALTER TABLE usuarios DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE usuarios ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
UPDATE usuarios SET cliente_id = (SELECT id FROM clientes WHERE slug = 'ambiente-legado')
WHERE perfil <> 'superadmin';
ALTER TABLE usuarios ADD CONSTRAINT usuarios_cliente_perfil_check CHECK (
  (perfil = 'superadmin' AND cliente_id IS NULL)
  OR (perfil <> 'superadmin' AND cliente_id IS NOT NULL)
);

ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_cnpj_key;
ALTER TABLE empresas ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
UPDATE empresas SET cliente_id = (SELECT id FROM clientes WHERE slug = 'ambiente-legado');
ALTER TABLE empresas ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE empresas ADD CONSTRAINT empresas_cliente_cnpj_key UNIQUE (cliente_id, cnpj);

ALTER TABLE equipes DROP CONSTRAINT IF EXISTS equipes_empresa_id_fkey;
ALTER TABLE equipes DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE equipes ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
UPDATE equipes SET cliente_id = (SELECT id FROM clientes WHERE slug = 'ambiente-legado');
ALTER TABLE equipes ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE equipes ADD COLUMN escopo escopo_cadastro NOT NULL DEFAULT 'global';

ALTER TABLE fvs_padrao DROP CONSTRAINT IF EXISTS fvs_padrao_empresa_id_fkey;
ALTER TABLE fvs_padrao DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE fvs_padrao ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
UPDATE fvs_padrao SET cliente_id = (SELECT id FROM clientes WHERE slug = 'ambiente-legado');
ALTER TABLE fvs_padrao ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE fvs_padrao ADD COLUMN escopo escopo_cadastro NOT NULL DEFAULT 'global';

-- Denormalized tenant key on every operational row makes RLS direct, fast and
-- independent of nested policies.
ALTER TABLE obras ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE obra_usuarios ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE obra_equipes ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE ambientes ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE fvs_padrao_revisoes ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE fvs_padrao_itens ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE fvs_planejadas ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE verificacoes ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE verificacao_itens ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE verificacao_fotos ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE nao_conformidades ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE nc_fotos ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE nc_reinspecoes ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE fvs_conclusoes ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE fvs_reaberturas ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT;

DO $$
DECLARE
  table_name text;
  legacy_cliente uuid := (SELECT id FROM clientes WHERE slug = 'ambiente-legado');
BEGIN
  IF legacy_cliente IS NOT NULL THEN
    FOREACH table_name IN ARRAY ARRAY[
      'obras', 'obra_usuarios', 'obra_equipes', 'ambientes',
      'fvs_padrao_revisoes', 'fvs_padrao_itens', 'fvs_planejadas',
      'verificacoes', 'verificacao_itens', 'verificacao_fotos',
      'nao_conformidades', 'nc_fotos', 'nc_reinspecoes',
      'fvs_conclusoes', 'fvs_reaberturas'
    ] LOOP
      EXECUTE format('UPDATE %I SET cliente_id = $1', table_name) USING legacy_cliente;
    END LOOP;
  END IF;
  FOREACH table_name IN ARRAY ARRAY[
    'obras', 'obra_usuarios', 'obra_equipes', 'ambientes',
    'fvs_padrao_revisoes', 'fvs_padrao_itens', 'fvs_planejadas',
    'verificacoes', 'verificacao_itens', 'verificacao_fotos',
    'nao_conformidades', 'nc_fotos', 'nc_reinspecoes',
    'fvs_conclusoes', 'fvs_reaberturas'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN cliente_id SET NOT NULL', table_name);
  END LOOP;
END
$$;

CREATE TABLE equipe_empresas (
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (equipe_id, empresa_id)
);

CREATE TABLE fvs_padrao_empresas (
  fvs_padrao_id uuid NOT NULL REFERENCES fvs_padrao(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fvs_padrao_id, empresa_id)
);

-- Every parent can now be referenced together with its tenant. Existing single
-- column FKs remain as useful compatibility constraints.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'usuarios', 'empresas', 'equipes', 'fvs_padrao', 'obras', 'obra_usuarios',
    'obra_equipes', 'ambientes', 'fvs_padrao_revisoes', 'fvs_padrao_itens',
    'fvs_planejadas', 'verificacoes', 'verificacao_itens', 'verificacao_fotos',
    'nao_conformidades', 'nc_fotos', 'nc_reinspecoes', 'fvs_conclusoes',
    'fvs_reaberturas'
  ] LOOP
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (id, cliente_id)',
      'uq_' || table_name || '_id_cliente', table_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (cliente_id)',
      'idx_' || table_name || '_cliente', table_name
    );
  END LOOP;
END
$$;

ALTER TABLE obras ADD CONSTRAINT obras_empresa_cliente_fkey
  FOREIGN KEY (empresa_id, cliente_id) REFERENCES empresas(id, cliente_id);
ALTER TABLE obra_usuarios ADD CONSTRAINT obra_usuarios_obra_cliente_fkey
  FOREIGN KEY (obra_id, cliente_id) REFERENCES obras(id, cliente_id);
ALTER TABLE obra_usuarios ADD CONSTRAINT obra_usuarios_usuario_cliente_fkey
  FOREIGN KEY (usuario_id, cliente_id) REFERENCES usuarios(id, cliente_id);
ALTER TABLE obra_equipes ADD CONSTRAINT obra_equipes_obra_cliente_fkey
  FOREIGN KEY (obra_id, cliente_id) REFERENCES obras(id, cliente_id);
ALTER TABLE obra_equipes ADD CONSTRAINT obra_equipes_equipe_cliente_fkey
  FOREIGN KEY (equipe_id, cliente_id) REFERENCES equipes(id, cliente_id);
ALTER TABLE ambientes ADD CONSTRAINT ambientes_obra_cliente_fkey
  FOREIGN KEY (obra_id, cliente_id) REFERENCES obras(id, cliente_id);
ALTER TABLE fvs_padrao_revisoes ADD CONSTRAINT fvs_revisoes_padrao_cliente_fkey
  FOREIGN KEY (fvs_padrao_id, cliente_id) REFERENCES fvs_padrao(id, cliente_id);
ALTER TABLE fvs_padrao_itens ADD CONSTRAINT fvs_itens_padrao_cliente_fkey
  FOREIGN KEY (fvs_padrao_id, cliente_id) REFERENCES fvs_padrao(id, cliente_id);
ALTER TABLE fvs_planejadas ADD CONSTRAINT fvs_planejadas_ambiente_cliente_fkey
  FOREIGN KEY (ambiente_id, cliente_id) REFERENCES ambientes(id, cliente_id);
ALTER TABLE fvs_planejadas ADD CONSTRAINT fvs_planejadas_padrao_cliente_fkey
  FOREIGN KEY (fvs_padrao_id, cliente_id) REFERENCES fvs_padrao(id, cliente_id);
ALTER TABLE verificacoes ADD CONSTRAINT verificacoes_fvs_cliente_fkey
  FOREIGN KEY (fvs_planejada_id, cliente_id) REFERENCES fvs_planejadas(id, cliente_id);
ALTER TABLE verificacoes ADD CONSTRAINT verificacoes_inspetor_cliente_fkey
  FOREIGN KEY (inspetor_id, cliente_id) REFERENCES usuarios(id, cliente_id);
ALTER TABLE verificacoes ADD CONSTRAINT verificacoes_equipe_cliente_fkey
  FOREIGN KEY (equipe_id, cliente_id) REFERENCES equipes(id, cliente_id);
ALTER TABLE verificacao_itens ADD CONSTRAINT verificacao_itens_verificacao_cliente_fkey
  FOREIGN KEY (verificacao_id, cliente_id) REFERENCES verificacoes(id, cliente_id);
ALTER TABLE verificacao_itens ADD CONSTRAINT verificacao_itens_padrao_cliente_fkey
  FOREIGN KEY (fvs_padrao_item_id, cliente_id) REFERENCES fvs_padrao_itens(id, cliente_id);
ALTER TABLE verificacao_fotos ADD CONSTRAINT verificacao_fotos_verificacao_cliente_fkey
  FOREIGN KEY (verificacao_id, cliente_id) REFERENCES verificacoes(id, cliente_id);
ALTER TABLE nao_conformidades ADD CONSTRAINT nc_verificacao_cliente_fkey
  FOREIGN KEY (verificacao_id, cliente_id) REFERENCES verificacoes(id, cliente_id);
ALTER TABLE nao_conformidades ADD CONSTRAINT nc_item_cliente_fkey
  FOREIGN KEY (verificacao_item_id, cliente_id) REFERENCES verificacao_itens(id, cliente_id);
ALTER TABLE nc_fotos ADD CONSTRAINT nc_fotos_nc_cliente_fkey
  FOREIGN KEY (nc_id, cliente_id) REFERENCES nao_conformidades(id, cliente_id);
ALTER TABLE nc_reinspecoes ADD CONSTRAINT nc_reinspecoes_nc_cliente_fkey
  FOREIGN KEY (nc_id, cliente_id) REFERENCES nao_conformidades(id, cliente_id);
ALTER TABLE nc_reinspecoes ADD CONSTRAINT nc_reinspecoes_verificacao_cliente_fkey
  FOREIGN KEY (verificacao_id, cliente_id) REFERENCES verificacoes(id, cliente_id);
ALTER TABLE fvs_conclusoes ADD CONSTRAINT fvs_conclusoes_planejada_cliente_fkey
  FOREIGN KEY (fvs_planejada_id, cliente_id) REFERENCES fvs_planejadas(id, cliente_id);
ALTER TABLE fvs_reaberturas ADD CONSTRAINT fvs_reaberturas_planejada_cliente_fkey
  FOREIGN KEY (fvs_planejada_id, cliente_id) REFERENCES fvs_planejadas(id, cliente_id);
ALTER TABLE equipe_empresas ADD CONSTRAINT equipe_empresas_equipe_cliente_fkey
  FOREIGN KEY (equipe_id, cliente_id) REFERENCES equipes(id, cliente_id);
ALTER TABLE equipe_empresas ADD CONSTRAINT equipe_empresas_empresa_cliente_fkey
  FOREIGN KEY (empresa_id, cliente_id) REFERENCES empresas(id, cliente_id);
ALTER TABLE fvs_padrao_empresas ADD CONSTRAINT fvs_empresas_padrao_cliente_fkey
  FOREIGN KEY (fvs_padrao_id, cliente_id) REFERENCES fvs_padrao(id, cliente_id);
ALTER TABLE fvs_padrao_empresas ADD CONSTRAINT fvs_empresas_empresa_cliente_fkey
  FOREIGN KEY (empresa_id, cliente_id) REFERENCES empresas(id, cliente_id);

CREATE INDEX idx_equipe_empresas_cliente ON equipe_empresas(cliente_id);
CREATE INDEX idx_fvs_padrao_empresas_cliente ON fvs_padrao_empresas(cliente_id);
CREATE INDEX idx_auditoria_plataforma_cliente ON auditoria_plataforma(cliente_id, created_at DESC);

-- Authentication/RLS helpers. They bypass usuarios RLS only to establish the
-- caller context; callers cannot choose another user id.
CREATE OR REPLACE FUNCTION get_cliente_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.cliente_id FROM usuarios u
  WHERE u.id = auth.uid() AND u.ativo = true
$$;

CREATE OR REPLACE FUNCTION get_perfil()
RETURNS perfil_usuario
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.perfil FROM usuarios u
  WHERE u.id = auth.uid() AND u.ativo = true
$$;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.ativo = true
      AND u.perfil = 'superadmin' AND u.cliente_id IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION has_cliente_access(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    JOIN clientes c ON c.id = u.cliente_id
    WHERE u.id = auth.uid() AND u.ativo = true
      AND c.status = 'ativo' AND u.cliente_id = p_cliente_id
  )
$$;

CREATE OR REPLACE FUNCTION has_obra_access(p_obra_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM obras o
    JOIN usuarios u ON u.id = auth.uid() AND u.cliente_id = o.cliente_id
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.id = p_obra_id AND u.ativo = true AND c.status = 'ativo'
      AND (
        u.perfil = 'admin'
        OR EXISTS (
          SELECT 1 FROM obra_usuarios ou
          WHERE ou.obra_id = o.id AND ou.usuario_id = u.id AND ou.ativo = true
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION has_fvs_access(p_fvs_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM fvs_planejadas fp
    JOIN ambientes a ON a.id = fp.ambiente_id
    WHERE fp.id = p_fvs_id AND has_obra_access(a.obra_id)
  )
$$;

CREATE OR REPLACE FUNCTION has_verificacao_access(p_verificacao_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM verificacoes v
    WHERE v.id = p_verificacao_id AND has_fvs_access(v.fvs_planejada_id)
  )
$$;

CREATE OR REPLACE FUNCTION has_nc_access(p_nc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM nao_conformidades nc
    WHERE nc.id = p_nc_id AND has_verificacao_access(nc.verificacao_id)
  )
$$;

REVOKE ALL ON FUNCTION get_cliente_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_perfil() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION has_cliente_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION has_obra_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION has_fvs_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION has_verificacao_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION has_nc_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_cliente_id(), get_perfil(), is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION has_cliente_access(uuid), has_obra_access(uuid), has_fvs_access(uuid), has_verificacao_access(uuid), has_nc_access(uuid) TO authenticated;

-- Replace legacy policies, including policies where an admin previously meant
-- global access across every company.
DO $$
DECLARE policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'empresas', 'usuarios', 'obras', 'obra_usuarios', 'obra_equipes',
        'equipes', 'fvs_padrao', 'fvs_padrao_revisoes', 'fvs_padrao_itens',
        'ambientes', 'fvs_planejadas', 'verificacoes', 'verificacao_itens',
        'verificacao_fotos', 'nao_conformidades', 'nc_fotos', 'nc_reinspecoes',
        'fvs_conclusoes', 'fvs_reaberturas'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  END LOOP;
END
$$;

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_plataforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fvs_padrao_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_platform_select ON clientes FOR SELECT
  USING (is_platform_admin() OR id = get_cliente_id());
CREATE POLICY clientes_platform_update ON clientes FOR UPDATE
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY auditoria_platform_select ON auditoria_plataforma FOR SELECT
  USING (is_platform_admin());

CREATE POLICY usuarios_tenant_select ON usuarios FOR SELECT
  USING (id = auth.uid() OR (cliente_id IS NOT NULL AND has_cliente_access(cliente_id)));
CREATE POLICY usuarios_tenant_insert ON usuarios FOR INSERT
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() = 'admin' AND perfil <> 'superadmin');
CREATE POLICY usuarios_tenant_update ON usuarios FOR UPDATE
  USING (has_cliente_access(cliente_id) AND get_perfil() = 'admin')
  WITH CHECK (has_cliente_access(cliente_id) AND perfil <> 'superadmin');

CREATE POLICY empresas_tenant_select ON empresas FOR SELECT USING (has_cliente_access(cliente_id));
CREATE POLICY empresas_tenant_insert ON empresas FOR INSERT
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() = 'admin');
CREATE POLICY empresas_tenant_update ON empresas FOR UPDATE
  USING (has_cliente_access(cliente_id) AND get_perfil() = 'admin')
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() = 'admin');

CREATE POLICY equipes_tenant_select ON equipes FOR SELECT USING (has_cliente_access(cliente_id));
CREATE POLICY equipes_tenant_write ON equipes FOR ALL
  USING (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'));
CREATE POLICY equipe_empresas_tenant ON equipe_empresas FOR ALL
  USING (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'));

CREATE POLICY fvs_padrao_tenant_select ON fvs_padrao FOR SELECT USING (has_cliente_access(cliente_id));
CREATE POLICY fvs_padrao_tenant_write ON fvs_padrao FOR ALL
  USING (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'));
CREATE POLICY fvs_padrao_empresas_tenant ON fvs_padrao_empresas FOR ALL
  USING (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'));
CREATE POLICY fvs_revisoes_tenant_select ON fvs_padrao_revisoes FOR SELECT USING (has_cliente_access(cliente_id));
CREATE POLICY fvs_revisoes_tenant_write ON fvs_padrao_revisoes FOR ALL
  USING (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'));
CREATE POLICY fvs_itens_tenant_select ON fvs_padrao_itens FOR SELECT USING (has_cliente_access(cliente_id));
CREATE POLICY fvs_itens_tenant_write ON fvs_padrao_itens FOR ALL
  USING (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'));

CREATE POLICY obras_tenant_select ON obras FOR SELECT USING (has_obra_access(id));
CREATE POLICY obras_admin_insert ON obras FOR INSERT
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() = 'admin');
CREATE POLICY obras_admin_update ON obras FOR UPDATE
  USING (has_cliente_access(cliente_id) AND get_perfil() = 'admin')
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() = 'admin');
CREATE POLICY obra_usuarios_tenant ON obra_usuarios FOR SELECT USING (has_obra_access(obra_id));
CREATE POLICY obra_usuarios_manage ON obra_usuarios FOR ALL
  USING (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'));
CREATE POLICY obra_equipes_tenant ON obra_equipes FOR SELECT USING (has_obra_access(obra_id));
CREATE POLICY obra_equipes_manage ON obra_equipes FOR ALL
  USING (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'));

CREATE POLICY ambientes_tenant ON ambientes FOR SELECT USING (has_obra_access(obra_id));
CREATE POLICY ambientes_manage ON ambientes FOR ALL
  USING (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_obra_access(obra_id) AND get_perfil() IN ('admin', 'gestor'));
CREATE POLICY fvs_planejadas_tenant ON fvs_planejadas FOR SELECT USING (has_fvs_access(id));
CREATE POLICY fvs_planejadas_manage ON fvs_planejadas FOR ALL
  USING (has_fvs_access(id) AND get_perfil() IN ('admin', 'gestor'))
  WITH CHECK (has_cliente_access(cliente_id) AND get_perfil() IN ('admin', 'gestor'));

CREATE POLICY verificacoes_tenant ON verificacoes FOR SELECT USING (has_verificacao_access(id));
CREATE POLICY verificacoes_write ON verificacoes FOR ALL
  USING (has_verificacao_access(id))
  WITH CHECK (has_fvs_access(fvs_planejada_id) AND inspetor_id = auth.uid());
CREATE POLICY verificacao_itens_tenant ON verificacao_itens FOR ALL
  USING (has_verificacao_access(verificacao_id))
  WITH CHECK (has_verificacao_access(verificacao_id));
CREATE POLICY verificacao_fotos_tenant ON verificacao_fotos FOR ALL
  USING (has_verificacao_access(verificacao_id))
  WITH CHECK (has_verificacao_access(verificacao_id));
CREATE POLICY nc_tenant ON nao_conformidades FOR ALL
  USING (has_verificacao_access(verificacao_id))
  WITH CHECK (has_verificacao_access(verificacao_id));
CREATE POLICY nc_fotos_tenant ON nc_fotos FOR ALL
  USING (has_nc_access(nc_id)) WITH CHECK (has_nc_access(nc_id));
CREATE POLICY nc_reinspecoes_tenant ON nc_reinspecoes FOR SELECT USING (has_nc_access(nc_id));
CREATE POLICY nc_reinspecoes_insert ON nc_reinspecoes FOR INSERT
  WITH CHECK (has_nc_access(nc_id) AND inspetor_id = auth.uid());
CREATE POLICY fvs_conclusoes_tenant ON fvs_conclusoes FOR SELECT USING (has_fvs_access(fvs_planejada_id));
CREATE POLICY fvs_conclusoes_insert ON fvs_conclusoes FOR INSERT
  WITH CHECK (has_fvs_access(fvs_planejada_id) AND inspetor_id = auth.uid());
CREATE POLICY fvs_reaberturas_tenant ON fvs_reaberturas FOR SELECT USING (has_fvs_access(fvs_planejada_id));
CREATE POLICY fvs_reaberturas_insert ON fvs_reaberturas FOR INSERT
  WITH CHECK (has_fvs_access(fvs_planejada_id) AND solicitado_por = auth.uid());

-- Quotas count active resources. Row locking serializes concurrent creations and
-- reactivations for the same client.
CREATE OR REPLACE FUNCTION enforce_cliente_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  limite integer;
  consumo integer;
  coluna_limite text;
BEGIN
  IF NEW.cliente_id IS NULL OR NEW.ativo IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.ativo IS TRUE AND OLD.cliente_id = NEW.cliente_id THEN
    RETURN NEW;
  END IF;

  coluna_limite := CASE TG_TABLE_NAME
    WHEN 'usuarios' THEN 'limite_usuarios'
    WHEN 'empresas' THEN 'limite_empresas'
    WHEN 'obras' THEN 'limite_obras'
  END;
  EXECUTE format('SELECT %I FROM clientes WHERE id = $1 FOR UPDATE', coluna_limite)
    INTO limite USING NEW.cliente_id;
  IF limite IS NULL THEN RETURN NEW; END IF;

  EXECUTE format('SELECT count(*) FROM %I WHERE cliente_id = $1 AND ativo = true', TG_TABLE_NAME)
    INTO consumo USING NEW.cliente_id;
  IF consumo >= limite THEN
    RAISE EXCEPTION 'Limite de % atingido para este cliente', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_limite_usuarios BEFORE INSERT OR UPDATE OF ativo, cliente_id ON usuarios
  FOR EACH ROW EXECUTE FUNCTION enforce_cliente_limit();
CREATE TRIGGER trg_limite_empresas BEFORE INSERT OR UPDATE OF ativo, cliente_id ON empresas
  FOR EACH ROW EXECUTE FUNCTION enforce_cliente_limit();
CREATE TRIGGER trg_limite_obras BEFORE INSERT OR UPDATE OF ativo, cliente_id ON obras
  FOR EACH ROW EXECUTE FUNCTION enforce_cliente_limit();

CREATE OR REPLACE FUNCTION validate_resource_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  obra_empresa uuid;
  recurso_escopo escopo_cadastro;
BEGIN
  IF TG_TABLE_NAME = 'obra_equipes' THEN
    SELECT empresa_id INTO obra_empresa FROM obras WHERE id = NEW.obra_id;
    SELECT escopo INTO recurso_escopo FROM equipes WHERE id = NEW.equipe_id;
    IF recurso_escopo = 'restrito' AND NOT EXISTS (
      SELECT 1 FROM equipe_empresas ee
      WHERE ee.equipe_id = NEW.equipe_id AND ee.empresa_id = obra_empresa
    ) THEN
      RAISE EXCEPTION 'Equipe não disponível para a empresa desta obra' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    SELECT o.empresa_id INTO obra_empresa
    FROM ambientes a JOIN obras o ON o.id = a.obra_id
    WHERE a.id = NEW.ambiente_id;
    SELECT escopo INTO recurso_escopo FROM fvs_padrao WHERE id = NEW.fvs_padrao_id;
    IF recurso_escopo = 'restrito' AND NOT EXISTS (
      SELECT 1 FROM fvs_padrao_empresas fe
      WHERE fe.fvs_padrao_id = NEW.fvs_padrao_id AND fe.empresa_id = obra_empresa
    ) THEN
      RAISE EXCEPTION 'FVS não disponível para a empresa desta obra' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_equipe_scope BEFORE INSERT OR UPDATE OF obra_id, equipe_id ON obra_equipes
  FOR EACH ROW EXECUTE FUNCTION validate_resource_scope();
CREATE TRIGGER trg_validate_fvs_scope BEFORE INSERT OR UPDATE OF ambiente_id, fvs_padrao_id ON fvs_planejadas
  FOR EACH ROW EXECUTE FUNCTION validate_resource_scope();

CREATE OR REPLACE FUNCTION get_clientes_resumo()
RETURNS TABLE (
  id uuid, nome text, slug text, status status_cliente,
  contato_nome text, contato_email text, contato_telefone text,
  limite_usuarios integer, limite_empresas integer, limite_obras integer,
  usuarios_ativos bigint, empresas_ativas bigint, obras_ativas bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à plataforma' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT c.id, c.nome, c.slug, c.status, c.contato_nome, c.contato_email,
    c.contato_telefone, c.limite_usuarios, c.limite_empresas, c.limite_obras,
    (SELECT count(*) FROM usuarios u WHERE u.cliente_id = c.id AND u.ativo),
    (SELECT count(*) FROM empresas e WHERE e.cliente_id = c.id AND e.ativo),
    (SELECT count(*) FROM obras o WHERE o.cliente_id = c.id AND o.ativo),
    c.created_at
  FROM clientes c ORDER BY c.nome;
END;
$$;

REVOKE ALL ON FUNCTION get_clientes_resumo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_clientes_resumo() TO authenticated;

CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Legacy helper is intentionally removed: empresa is no longer the tenant.
DROP FUNCTION IF EXISTS get_empresa_id();
