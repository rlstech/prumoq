CREATE TABLE public.ambientes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  obra_id uuid NOT NULL,
  nome text NOT NULL,
  tipo tipo_ambiente NOT NULL DEFAULT 'interno'::tipo_ambiente,
  localizacao text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.auditoria_operacional (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  obra_id uuid,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  acao text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.auditoria_plataforma (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  ator_id uuid,
  cliente_id uuid,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.avaliacao_empreiteiro_itens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  avaliacao_id uuid NOT NULL,
  criterio_origem_id uuid,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  peso smallint NOT NULL,
  resultado resultado_criterio_avaliacao,
  comentario_nao_atende text,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.avaliacao_empreiteiro_reaberturas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  avaliacao_id uuid NOT NULL,
  reaberto_por uuid NOT NULL,
  motivo text NOT NULL,
  numero_reabertura integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  avaliador_anterior_id uuid NOT NULL);

CREATE TABLE public.avaliacoes_empreiteiro (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  equipe_id uuid NOT NULL,
  medicao_id uuid,
  modelo_revisao_id uuid NOT NULL,
  data_avaliacao date NOT NULL DEFAULT CURRENT_DATE,
  notificacoes_ocorridas text,
  providencias_tomadas text,
  pontos_obtidos numeric(8,2) NOT NULL DEFAULT 0,
  pontos_possiveis numeric(8,2) NOT NULL DEFAULT 0,
  percentual numeric(6,2) NOT NULL DEFAULT 0,
  status status_avaliacao_empreiteiro NOT NULL DEFAULT 'rascunho'::status_avaliacao_empreiteiro,
  avaliador_id uuid NOT NULL,
  assinatura_url text,
  assinada_em timestamp with time zone,
  concluida_em timestamp with time zone,
  invalidada_por uuid,
  invalidada_em timestamp with time zone,
  motivo_invalidacao text,
  created_offline boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  aprovada_por uuid,
  aprovada_em timestamp with time zone,
  ultimo_motivo_reabertura text);

CREATE TABLE public.avancos_aprovados_servico (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  vinculacao_id uuid NOT NULL,
  verificacao_id uuid NOT NULL,
  etapa_id uuid,
  executado_anterior numeric(18,6) NOT NULL,
  executado_atual numeric(18,6) NOT NULL,
  aprovado_anterior numeric(18,6) NOT NULL,
  aprovado_atual numeric(18,6) NOT NULL,
  unidade text NOT NULL,
  aprovado_por uuid NOT NULL,
  data_aprovacao timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_offline boolean NOT NULL DEFAULT false);

CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nome text NOT NULL,
  slug text NOT NULL,
  status status_cliente NOT NULL DEFAULT 'ativo'::status_cliente,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  limite_usuarios integer,
  limite_empresas integer,
  limite_obras integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.empresas (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nome text NOT NULL,
  cnpj text NOT NULL,
  ie text,
  endereco text,
  municipio text,
  uf character(2),
  cep text,
  contato text,
  email text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL,
  controle_medicoes_habilitado boolean NOT NULL DEFAULT false,
  controle_financeiro_nc_habilitado boolean NOT NULL DEFAULT false);

CREATE TABLE public.equipe_empresas (
  equipe_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.equipes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nome text NOT NULL,
  tipo tipo_equipe NOT NULL DEFAULT 'proprio'::tipo_equipe,
  responsavel text,
  telefone text,
  cnpj_terceiro text,
  especialidade text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL,
  escopo escopo_cadastro NOT NULL DEFAULT 'global'::escopo_cadastro);

CREATE TABLE public.fvs_conclusoes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  fvs_planejada_id uuid NOT NULL,
  inspetor_id uuid NOT NULL,
  numero_conclusao integer NOT NULL DEFAULT 1,
  percentual_final integer NOT NULL,
  resultado text NOT NULL,
  motivo_antes_100 text,
  tipo_motivo text,
  observacao_final text,
  assinatura_url text,
  assinada_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  verificacao_id uuid,
  cliente_id uuid NOT NULL);

CREATE TABLE public.fvs_medicao_configuracoes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  fvs_planejada_id uuid NOT NULL,
  metodo metodo_medicao_servico NOT NULL,
  unidade text NOT NULL,
  quantidade_total numeric(18,6) NOT NULL,
  preco_unitario numeric(18,4),
  permite_medicoes_parciais boolean NOT NULL DEFAULT true,
  modelo_origem_id uuid,
  criado_por uuid NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.fvs_medicao_etapas (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  configuracao_id uuid NOT NULL,
  ordem integer NOT NULL,
  nome text NOT NULL,
  peso_percentual numeric(7,4) NOT NULL,
  permite_avanco_parcial boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status status_etapa_medicao NOT NULL DEFAULT 'nao_iniciada'::status_etapa_medicao,
  percentual_interno numeric(7,4),
  equipe_responsavel_id uuid,
  verificacao_evidencia_id uuid,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.fvs_padrao (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nome text NOT NULL,
  descricao text,
  categoria categoria_fvs NOT NULL DEFAULT 'outro'::categoria_fvs,
  norma_ref text,
  revisao_atual integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  codigo text,
  cliente_id uuid NOT NULL,
  escopo escopo_cadastro NOT NULL DEFAULT 'global'::escopo_cadastro);

CREATE TABLE public.fvs_padrao_empresas (
  fvs_padrao_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.fvs_padrao_itens (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  fvs_padrao_id uuid NOT NULL,
  revisao integer NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  titulo text NOT NULL,
  metodo_verif text,
  tolerancia text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.fvs_padrao_revisoes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  fvs_padrao_id uuid NOT NULL,
  numero_revisao integer NOT NULL,
  descricao_alt text NOT NULL,
  revisado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.fvs_planejadas (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  ambiente_id uuid NOT NULL,
  fvs_padrao_id uuid NOT NULL,
  revisao_associada integer NOT NULL,
  subservico text,
  status status_fvs NOT NULL DEFAULT 'pendente'::status_fvs,
  concluida_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  percentual_exec integer NOT NULL DEFAULT 0,
  total_reaberturas integer NOT NULL DEFAULT 0,
  total_conclusoes integer NOT NULL DEFAULT 0,
  ultima_conclusao_em timestamp with time zone,
  ultima_reabertura_em timestamp with time zone,
  cliente_id uuid NOT NULL);

CREATE TABLE public.fvs_reaberturas (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  fvs_planejada_id uuid NOT NULL,
  solicitado_por uuid NOT NULL,
  autorizado_por uuid NOT NULL,
  motivo_tipo text NOT NULL,
  justificativa text NOT NULL,
  numero_reabertura integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.medicao_item_liberacoes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  medicao_item_id uuid NOT NULL,
  avanco_id uuid NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  quantidade_utilizada numeric(18,6) NOT NULL);

CREATE TABLE public.medicao_servico_itens (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  medicao_id uuid NOT NULL,
  vinculacao_id uuid NOT NULL,
  etapa_id uuid,
  verificacao_id uuid,
  nc_id uuid,
  tipo tipo_item_medicao NOT NULL DEFAULT 'avanco'::tipo_item_medicao,
  quantidade_anterior numeric(18,6) NOT NULL DEFAULT 0,
  quantidade_atual numeric(18,6) NOT NULL DEFAULT 0,
  quantidade_periodo numeric(18,6) NOT NULL DEFAULT 0,
  quantidade_bloqueada numeric(18,6) NOT NULL DEFAULT 0,
  unidade text NOT NULL,
  preco_unitario numeric(18,4),
  valor_calculado numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.medicoes_servico (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  equipe_id uuid NOT NULL,
  referencia text NOT NULL,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  data_medicao date NOT NULL DEFAULT CURRENT_DATE,
  status status_medicao_servico NOT NULL DEFAULT 'rascunho'::status_medicao_servico,
  observacao text,
  criado_por uuid NOT NULL,
  aprovado_por uuid,
  aprovado_em timestamp with time zone,
  cancelado_por uuid,
  cancelado_em timestamp with time zone,
  motivo_cancelamento text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.modelo_avaliacao_empreiteiro_criterios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  revisao_id uuid NOT NULL,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  peso smallint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.modelo_avaliacao_empreiteiro_revisoes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  modelo_id uuid NOT NULL,
  numero_revisao integer NOT NULL,
  descricao_alteracoes text NOT NULL,
  publicado_por uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.modelo_etapas_medicao_itens (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  modelo_id uuid NOT NULL,
  ordem integer NOT NULL,
  nome text NOT NULL,
  peso_percentual numeric(7,4) NOT NULL,
  permite_avanco_parcial boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true);

CREATE TABLE public.modelos_avaliacao_empreiteiro (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  descricao text,
  revisao_atual integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.modelos_etapas_medicao (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.nao_conformidades (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  verificacao_id uuid NOT NULL,
  verificacao_item_id uuid NOT NULL,
  descricao text NOT NULL,
  solucao_proposta text NOT NULL,
  responsavel_id uuid,
  data_nova_verif date NOT NULL,
  prioridade text NOT NULL DEFAULT 'media'::text,
  status status_nc NOT NULL DEFAULT 'aberta'::status_nc,
  resolvida_na_verif_id uuid,
  resolvida_em timestamp with time zone,
  observacao_resolucao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  nc_anterior_id uuid,
  numero_ocorrencia integer NOT NULL DEFAULT 1,
  verificacao_reinsp_id uuid,
  foto_reinspecao_url text,
  cliente_id uuid NOT NULL,
  financeiro_requerido boolean NOT NULL DEFAULT false,
  situacao_financeira situacao_impacto_financeiro_nc,
  justificativa_sem_impacto text,
  responsavel_avaliacao_id uuid,
  prazo_avaliacao date,
  valor_estimado numeric(18,4),
  valor_confirmado numeric(18,4),
  responsavel_financeiro responsavel_financeiro_nc,
  categoria_financeira categoria_impacto_financeiro_nc,
  observacao_financeira text,
  documento_financeiro_r2_key text,
  bloqueio_medicao bloqueio_medicao_nc,
  quantidade_bloqueada numeric(18,6),
  percentual_bloqueado numeric(7,4),
  valor_bloqueado numeric(18,4));

CREATE TABLE public.nc_financeiro_historico (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  nc_id uuid NOT NULL,
  situacao situacao_impacto_financeiro_nc,
  bloqueio bloqueio_medicao_nc,
  dados jsonb NOT NULL,
  alterado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE public.nc_fotos (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nc_id uuid NOT NULL,
  r2_key text NOT NULL,
  r2_thumb_key text,
  nome_arquivo text,
  tamanho_bytes integer,
  mime_type text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.nc_reinspecoes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nc_id uuid NOT NULL,
  verificacao_id uuid NOT NULL,
  inspetor_id uuid NOT NULL,
  resultado text NOT NULL,
  observacao text,
  foto_url text,
  nova_nc_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.obra_equipes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  obra_id uuid NOT NULL,
  equipe_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.obra_usuarios (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  obra_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'inspetor'::text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.obras (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text,
  endereco text,
  municipio text,
  uf character(2),
  cep text,
  area_total_m2 numeric(10,2),
  num_pavimentos integer,
  eng_responsavel text NOT NULL,
  crea_cau text NOT NULL,
  num_art text,
  num_alvara text,
  status status_obra NOT NULL DEFAULT 'nao_iniciada'::status_obra,
  data_inicio_prev date,
  data_inicio_real date,
  data_termino_prev date,
  data_termino_real date,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL,
  controle_medicoes_override boolean,
  controle_financeiro_nc_override boolean,
  controle_medicoes_efetivo boolean NOT NULL DEFAULT false,
  controle_financeiro_nc_efetivo boolean NOT NULL DEFAULT false);

CREATE TABLE public.usuarios (
  id uuid NOT NULL,
  nome text NOT NULL,
  cargo text,
  telefone text,
  perfil perfil_usuario NOT NULL DEFAULT 'inspetor'::perfil_usuario,
  ativo boolean NOT NULL DEFAULT true,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid,
  onboarding_concluido_em timestamp with time zone,
  assinatura_padrao_url text,
  assinatura_padrao_atualizada_em timestamp with time zone);

CREATE TABLE public.verificacao_fotos (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  verificacao_id uuid NOT NULL,
  r2_key text NOT NULL,
  r2_thumb_key text,
  nome_arquivo text,
  tamanho_bytes integer,
  mime_type text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.verificacao_itens (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  verificacao_id uuid NOT NULL,
  fvs_padrao_item_id uuid NOT NULL,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  metodo_verif text,
  tolerancia text,
  resultado resultado_item NOT NULL DEFAULT 'na'::resultado_item,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.verificacoes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  fvs_planejada_id uuid NOT NULL,
  numero_verif integer NOT NULL,
  inspetor_id uuid NOT NULL,
  equipe_id uuid,
  data_verif date NOT NULL,
  percentual_exec integer NOT NULL DEFAULT 0,
  status status_fvs NOT NULL DEFAULT 'em_andamento'::status_fvs,
  observacoes text,
  assinatura_url text,
  assinada_em timestamp with time zone,
  sync_id uuid DEFAULT extensions.uuid_generate_v4(),
  created_offline boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_id uuid NOT NULL);

CREATE TABLE public.vinculos_execucao_servico (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  cliente_id uuid NOT NULL,
  fvs_planejada_id uuid NOT NULL,
  etapa_id uuid,
  equipe_id uuid NOT NULL,
  data_inicio date NOT NULL,
  data_termino date,
  escopo_atribuido numeric(18,6) NOT NULL,
  aprovado_congelado numeric(18,6) NOT NULL DEFAULT 0,
  medido_congelado numeric(18,6) NOT NULL DEFAULT 0,
  status status_vinculo_execucao NOT NULL DEFAULT 'ativo'::status_vinculo_execucao,
  motivo_encerramento text,
  criado_por uuid NOT NULL,
  encerrado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now());
