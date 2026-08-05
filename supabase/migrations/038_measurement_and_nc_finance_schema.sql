-- Módulos opcionais: medições de serviços e impacto financeiro de NC.
-- Tudo inicia desabilitado; nenhum registro existente exige preenchimento.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS controle_medicoes_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controle_financeiro_nc_habilitado boolean NOT NULL DEFAULT false;

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS controle_medicoes_override boolean,
  ADD COLUMN IF NOT EXISTS controle_financeiro_nc_override boolean,
  ADD COLUMN IF NOT EXISTS controle_medicoes_efetivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controle_financeiro_nc_efetivo boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE metodo_medicao_servico AS ENUM ('quantidade', 'unidade_concluida', 'etapas_ponderadas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE status_etapa_medicao AS ENUM ('nao_iniciada', 'em_execucao', 'concluida', 'aprovada', 'bloqueada_nc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE status_vinculo_execucao AS ENUM ('ativo', 'concluido', 'substituido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE status_medicao_servico AS ENUM ('rascunho', 'aprovada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE tipo_item_medicao AS ENUM ('avanco', 'retrabalho');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE situacao_impacto_financeiro_nc AS ENUM ('sem_impacto', 'em_avaliacao', 'estimado', 'confirmado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE categoria_impacto_financeiro_nc AS ENUM ('mao_obra_retrabalho', 'perda_material', 'equipamento_mobilizacao', 'atraso', 'glosa_retencao', 'desconto_empreiteiro', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE responsavel_financeiro_nc AS ENUM ('construtora', 'empreiteiro', 'fornecedor', 'projetista', 'em_analise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE bloqueio_medicao_nc AS ENUM ('nao', 'total', 'parcial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS modelos_etapas_medicao (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  ativo boolean NOT NULL DEFAULT false,
  criado_por uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS modelo_etapas_medicao_itens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  modelo_id uuid NOT NULL REFERENCES modelos_etapas_medicao(id),
  ordem integer NOT NULL CHECK (ordem > 0),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  peso_percentual numeric(7,4) NOT NULL CHECK (peso_percentual > 0 AND peso_percentual <= 100),
  permite_avanco_parcial boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (modelo_id, ordem)
);

CREATE TABLE IF NOT EXISTS fvs_medicao_configuracoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  fvs_planejada_id uuid NOT NULL UNIQUE REFERENCES fvs_planejadas(id),
  metodo metodo_medicao_servico NOT NULL,
  unidade text NOT NULL CHECK (length(trim(unidade)) > 0),
  quantidade_total numeric(18,6) NOT NULL CHECK (quantidade_total > 0),
  preco_unitario numeric(18,4) CHECK (preco_unitario >= 0),
  permite_medicoes_parciais boolean NOT NULL DEFAULT true,
  modelo_origem_id uuid REFERENCES modelos_etapas_medicao(id),
  criado_por uuid NOT NULL REFERENCES usuarios(id),
  updated_by uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((metodo <> 'unidade_concluida') OR (quantidade_total = 1 AND permite_medicoes_parciais = false))
);

CREATE TABLE IF NOT EXISTS fvs_medicao_etapas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  configuracao_id uuid NOT NULL REFERENCES fvs_medicao_configuracoes(id),
  ordem integer NOT NULL CHECK (ordem > 0),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  peso_percentual numeric(7,4) NOT NULL CHECK (peso_percentual > 0 AND peso_percentual <= 100),
  permite_avanco_parcial boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (configuracao_id, ordem)
);

CREATE TABLE IF NOT EXISTS vinculos_execucao_servico (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  fvs_planejada_id uuid NOT NULL REFERENCES fvs_planejadas(id),
  etapa_id uuid REFERENCES fvs_medicao_etapas(id),
  equipe_id uuid NOT NULL REFERENCES equipes(id),
  data_inicio date NOT NULL,
  data_termino date,
  escopo_atribuido numeric(18,6) NOT NULL CHECK (escopo_atribuido > 0),
  aprovado_congelado numeric(18,6) NOT NULL DEFAULT 0 CHECK (aprovado_congelado >= 0),
  medido_congelado numeric(18,6) NOT NULL DEFAULT 0 CHECK (medido_congelado >= 0),
  status status_vinculo_execucao NOT NULL DEFAULT 'ativo',
  motivo_encerramento text,
  criado_por uuid NOT NULL REFERENCES usuarios(id),
  encerrado_por uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'ativo' AND data_termino IS NULL) OR (status <> 'ativo' AND data_termino IS NOT NULL AND motivo_encerramento IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS vinculos_execucao_ativo_por_escopo
  ON vinculos_execucao_servico (fvs_planejada_id, COALESCE(etapa_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'ativo';

CREATE TABLE IF NOT EXISTS avancos_aprovados_servico (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  vinculacao_id uuid NOT NULL REFERENCES vinculos_execucao_servico(id),
  verificacao_id uuid NOT NULL REFERENCES verificacoes(id),
  etapa_id uuid REFERENCES fvs_medicao_etapas(id),
  executado_anterior numeric(18,6) NOT NULL CHECK (executado_anterior >= 0),
  executado_atual numeric(18,6) NOT NULL CHECK (executado_atual >= executado_anterior),
  aprovado_anterior numeric(18,6) NOT NULL CHECK (aprovado_anterior >= 0),
  aprovado_atual numeric(18,6) NOT NULL CHECK (aprovado_atual >= aprovado_anterior),
  unidade text NOT NULL,
  aprovado_por uuid NOT NULL REFERENCES usuarios(id),
  data_aprovacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (verificacao_id, vinculacao_id)
);

CREATE TABLE IF NOT EXISTS medicoes_servico (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  obra_id uuid NOT NULL REFERENCES obras(id),
  equipe_id uuid NOT NULL REFERENCES equipes(id),
  referencia text NOT NULL CHECK (length(trim(referencia)) > 0),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL CHECK (periodo_fim >= periodo_inicio),
  data_medicao date NOT NULL DEFAULT current_date,
  status status_medicao_servico NOT NULL DEFAULT 'rascunho',
  observacao text,
  criado_por uuid NOT NULL REFERENCES usuarios(id),
  aprovado_por uuid REFERENCES usuarios(id),
  aprovado_em timestamptz,
  cancelado_por uuid REFERENCES usuarios(id),
  cancelado_em timestamptz,
  motivo_cancelamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'aprovada') = (aprovado_em IS NOT NULL)),
  CHECK ((status = 'cancelada') = (cancelado_em IS NOT NULL AND motivo_cancelamento IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS medicao_servico_itens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  medicao_id uuid NOT NULL REFERENCES medicoes_servico(id),
  vinculacao_id uuid NOT NULL REFERENCES vinculos_execucao_servico(id),
  etapa_id uuid REFERENCES fvs_medicao_etapas(id),
  verificacao_id uuid REFERENCES verificacoes(id),
  nc_id uuid REFERENCES nao_conformidades(id),
  tipo tipo_item_medicao NOT NULL DEFAULT 'avanco',
  quantidade_anterior numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantidade_anterior >= 0),
  quantidade_atual numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantidade_atual >= quantidade_anterior),
  quantidade_periodo numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantidade_periodo >= 0),
  quantidade_bloqueada numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantidade_bloqueada >= 0),
  unidade text NOT NULL,
  preco_unitario numeric(18,4) CHECK (preco_unitario >= 0),
  valor_calculado numeric(18,4) NOT NULL DEFAULT 0 CHECK (valor_calculado >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((tipo = 'avanco' AND quantidade_periodo > 0) OR (tipo = 'retrabalho' AND nc_id IS NOT NULL AND valor_calculado > 0))
);

CREATE TABLE IF NOT EXISTS medicao_item_liberacoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  medicao_item_id uuid NOT NULL REFERENCES medicao_servico_itens(id),
  avanco_id uuid NOT NULL REFERENCES avancos_aprovados_servico(id),
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicao_item_id, avanco_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS medicao_liberacao_ativa_unica
  ON medicao_item_liberacoes (avanco_id) WHERE ativa;

CREATE TABLE IF NOT EXISTS auditoria_operacional (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  obra_id uuid REFERENCES obras(id),
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  acao text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nao_conformidades
  ADD COLUMN IF NOT EXISTS financeiro_requerido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS situacao_financeira situacao_impacto_financeiro_nc,
  ADD COLUMN IF NOT EXISTS justificativa_sem_impacto text,
  ADD COLUMN IF NOT EXISTS responsavel_avaliacao_id uuid REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS prazo_avaliacao date,
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(18,4),
  ADD COLUMN IF NOT EXISTS valor_confirmado numeric(18,4),
  ADD COLUMN IF NOT EXISTS responsavel_financeiro responsavel_financeiro_nc,
  ADD COLUMN IF NOT EXISTS categoria_financeira categoria_impacto_financeiro_nc,
  ADD COLUMN IF NOT EXISTS observacao_financeira text,
  ADD COLUMN IF NOT EXISTS documento_financeiro_r2_key text,
  ADD COLUMN IF NOT EXISTS bloqueio_medicao bloqueio_medicao_nc,
  ADD COLUMN IF NOT EXISTS quantidade_bloqueada numeric(18,6),
  ADD COLUMN IF NOT EXISTS percentual_bloqueado numeric(7,4);

CREATE TABLE IF NOT EXISTS nc_financeiro_historico (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  nc_id uuid NOT NULL REFERENCES nao_conformidades(id),
  situacao situacao_impacto_financeiro_nc,
  bloqueio bloqueio_medicao_nc,
  dados jsonb NOT NULL,
  alterado_por uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avancos_aprovados_vinculo_idx ON avancos_aprovados_servico(vinculacao_id, data_aprovacao);
CREATE INDEX IF NOT EXISTS medicoes_obra_status_idx ON medicoes_servico(obra_id, status, data_medicao DESC);
CREATE INDEX IF NOT EXISTS medicao_itens_vinculo_idx ON medicao_servico_itens(vinculacao_id);
CREATE INDEX IF NOT EXISTS nc_financeiro_situacao_idx ON nao_conformidades(situacao_financeira) WHERE situacao_financeira IS NOT NULL;
