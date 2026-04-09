-- ============================================================
-- PrumoQ — Schema Supabase (PostgreSQL 15)
-- ============================================================
-- Execução: Supabase SQL Editor
-- Dependências: extensão uuid-ossp (ativa por padrão no Supabase)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────────
create type perfil_usuario as enum ('admin', 'gestor', 'inspetor');
create type tipo_ambiente as enum ('interno', 'externo');
create type status_obra as enum ('nao_iniciada', 'em_andamento', 'paralisada', 'concluida');
create type status_fvs as enum ('pendente', 'em_andamento', 'conforme', 'nao_conforme');
create type resultado_item as enum ('conforme', 'nao_conforme', 'na');
create type status_nc as enum ('aberta', 'em_correcao', 'resolvida', 'cancelada');
create type tipo_equipe as enum ('proprio', 'terceirizado');
create type categoria_fvs as enum (
  'estrutura', 'vedacao', 'revestimento', 'instalacoes',
  'cobertura', 'acabamento', 'fundacao', 'terraplanagem', 'outro'
);

-- ============================================================
-- EMPRESAS
-- ============================================================
create table empresas (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  cnpj        text unique not null,
  ie          text,
  endereco    text,
  municipio   text,
  uf          char(2),
  cep         text,
  contato     text,
  email       text,
  telefone    text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- USUÁRIOS (extends Supabase auth.users)
-- ============================================================
create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  empresa_id  uuid references empresas(id) on delete set null,
  nome        text not null,
  cargo       text,
  telefone    text,
  perfil      perfil_usuario not null default 'inspetor',
  ativo       boolean not null default true,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- OBRAS
-- ============================================================
create table obras (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid not null references empresas(id) on delete restrict,
  nome                text not null,
  tipo                text,
  endereco            text,
  municipio           text,
  uf                  char(2),
  cep                 text,
  area_total_m2       numeric(10,2),
  num_pavimentos      integer,
  eng_responsavel     text not null,
  crea_cau            text not null,
  num_art             text,
  num_alvara          text,
  status              status_obra not null default 'nao_iniciada',
  data_inicio_prev    date,
  data_inicio_real    date,
  data_termino_prev   date,
  data_termino_real   date,
  observacoes         text,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Acesso de usuários por obra
create table obra_usuarios (
  id          uuid primary key default uuid_generate_v4(),
  obra_id     uuid not null references obras(id) on delete cascade,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  papel       text not null default 'inspetor',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique(obra_id, usuario_id)
);

-- ============================================================
-- EQUIPES
-- ============================================================
create table equipes (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nome            text not null,
  tipo            tipo_equipe not null default 'proprio',
  responsavel     text,
  telefone        text,
  cnpj_terceiro   text,
  especialidade   text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- FVS PADRÃO
-- ============================================================
create table fvs_padrao (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nome            text not null,
  descricao       text,
  categoria       categoria_fvs not null default 'outro',
  norma_ref       text,
  revisao_atual   integer not null default 1,
  ativo           boolean not null default true,
  created_by      uuid references usuarios(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table fvs_padrao_revisoes (
  id              uuid primary key default uuid_generate_v4(),
  fvs_padrao_id   uuid not null references fvs_padrao(id) on delete cascade,
  numero_revisao  integer not null,
  descricao_alt   text not null,
  revisado_por    uuid references usuarios(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique(fvs_padrao_id, numero_revisao)
);

create table fvs_padrao_itens (
  id              uuid primary key default uuid_generate_v4(),
  fvs_padrao_id   uuid not null references fvs_padrao(id) on delete cascade,
  revisao         integer not null,
  ordem           integer not null default 0,
  titulo          text not null,
  metodo_verif    text,
  tolerancia      text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- AMBIENTES
-- ============================================================
create table ambientes (
  id              uuid primary key default uuid_generate_v4(),
  obra_id         uuid not null references obras(id) on delete cascade,
  nome            text not null,
  tipo            tipo_ambiente not null default 'interno',
  localizacao     text,
  observacoes     text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- FVS PLANEJADAS
-- ============================================================
create table fvs_planejadas (
  id                  uuid primary key default uuid_generate_v4(),
  ambiente_id         uuid not null references ambientes(id) on delete cascade,
  fvs_padrao_id       uuid not null references fvs_padrao(id) on delete restrict,
  revisao_associada   integer not null,
  subservico          text,
  status              status_fvs not null default 'pendente',
  concluida_em        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(ambiente_id, fvs_padrao_id)
);

-- ============================================================
-- VERIFICAÇÕES
-- ============================================================
create table verificacoes (
  id                  uuid primary key default uuid_generate_v4(),
  fvs_planejada_id    uuid not null references fvs_planejadas(id) on delete cascade,
  numero_verif        integer not null,
  inspetor_id         uuid not null references usuarios(id) on delete restrict,
  equipe_id           uuid references equipes(id) on delete set null,
  data_verif          date not null,
  percentual_exec     integer not null default 0 check(percentual_exec between 0 and 100),
  status              status_fvs not null default 'em_andamento',
  observacoes         text,
  assinatura_url      text,
  assinada_em         timestamptz,
  sync_id             uuid default uuid_generate_v4(),
  created_offline     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- ITENS DE VERIFICAÇÃO
-- ============================================================
create table verificacao_itens (
  id                  uuid primary key default uuid_generate_v4(),
  verificacao_id      uuid not null references verificacoes(id) on delete cascade,
  fvs_padrao_item_id  uuid not null references fvs_padrao_itens(id) on delete restrict,
  ordem               integer not null,
  titulo              text not null,
  metodo_verif        text,
  tolerancia          text,
  resultado           resultado_item not null default 'na',
  created_at          timestamptz not null default now()
);

-- ============================================================
-- FOTOS DE VERIFICAÇÃO
-- ============================================================
create table verificacao_fotos (
  id              uuid primary key default uuid_generate_v4(),
  verificacao_id  uuid not null references verificacoes(id) on delete cascade,
  r2_key          text not null,
  r2_thumb_key    text,
  nome_arquivo    text,
  tamanho_bytes   integer,
  mime_type       text,
  ordem           integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- NÃO CONFORMIDADES
-- ============================================================
create table nao_conformidades (
  id                    uuid primary key default uuid_generate_v4(),
  verificacao_id        uuid not null references verificacoes(id) on delete cascade,
  verificacao_item_id   uuid not null references verificacao_itens(id) on delete cascade,
  descricao             text not null,
  solucao_proposta      text not null,
  responsavel_id        uuid references equipes(id) on delete set null,
  data_nova_verif       date not null,
  prioridade            text not null default 'media',
  status                status_nc not null default 'aberta',
  resolvida_na_verif_id uuid references verificacoes(id) on delete set null,
  resolvida_em          timestamptz,
  observacao_resolucao  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table nc_fotos (
  id              uuid primary key default uuid_generate_v4(),
  nc_id           uuid not null references nao_conformidades(id) on delete cascade,
  r2_key          text not null,
  r2_thumb_key    text,
  nome_arquivo    text,
  tamanho_bytes   integer,
  mime_type       text,
  ordem           integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index idx_obras_empresa on obras(empresa_id);
create index idx_obra_usuarios_obra on obra_usuarios(obra_id);
create index idx_obra_usuarios_usuario on obra_usuarios(usuario_id);
create index idx_ambientes_obra on ambientes(obra_id);
create index idx_fvs_padrao_empresa on fvs_padrao(empresa_id);
create index idx_fvs_padrao_itens_fvs on fvs_padrao_itens(fvs_padrao_id, revisao);
create index idx_fvs_planejadas_ambiente on fvs_planejadas(ambiente_id);
create index idx_verificacoes_fvs on verificacoes(fvs_planejada_id);
create index idx_verificacoes_inspetor on verificacoes(inspetor_id);
create index idx_verificacoes_data on verificacoes(data_verif);
create index idx_verificacao_itens_verif on verificacao_itens(verificacao_id);
create index idx_nc_verificacao on nao_conformidades(verificacao_id);
create index idx_nc_status on nao_conformidades(status);
create index idx_nc_data_nova_verif on nao_conformidades(data_nova_verif);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table empresas             enable row level security;
alter table usuarios             enable row level security;
alter table obras                enable row level security;
alter table obra_usuarios        enable row level security;
alter table equipes              enable row level security;
alter table fvs_padrao           enable row level security;
alter table fvs_padrao_revisoes  enable row level security;
alter table fvs_padrao_itens     enable row level security;
alter table ambientes            enable row level security;
alter table fvs_planejadas       enable row level security;
alter table verificacoes         enable row level security;
alter table verificacao_itens    enable row level security;
alter table verificacao_fotos    enable row level security;
alter table nao_conformidades    enable row level security;
alter table nc_fotos             enable row level security;

-- Helpers
create or replace function get_perfil()
returns perfil_usuario as $$
  select perfil from usuarios where id = auth.uid()
$$ language sql security definer stable;

create or replace function get_empresa_id()
returns uuid as $$
  select empresa_id from usuarios where id = auth.uid()
$$ language sql security definer stable;

create or replace function get_obras_acesso()
returns setof uuid as $$
  select obra_id from obra_usuarios
  where usuario_id = auth.uid() and ativo = true
$$ language sql security definer stable;

-- Políticas: Empresas
create policy "admin_all_empresas" on empresas
  for all using (get_perfil() = 'admin');
create policy "outros_propria_empresa" on empresas
  for select using (id = get_empresa_id());

-- Políticas: Usuários
create policy "admin_all_usuarios" on usuarios
  for all using (get_perfil() = 'admin');
create policy "usuario_proprios_dados" on usuarios
  for select using (id = auth.uid());

-- Políticas: Obras
create policy "admin_gestor_all_obras" on obras
  for all using (
    get_perfil() in ('admin', 'gestor')
    and empresa_id = get_empresa_id()
  );
create policy "inspetor_obras_acesso" on obras
  for select using (id in (select get_obras_acesso()));

-- Políticas: Ambientes
create policy "admin_gestor_ambientes" on ambientes
  for all using (
    obra_id in (
      select id from obras where empresa_id = get_empresa_id()
    ) and get_perfil() in ('admin', 'gestor')
  );
create policy "inspetor_ambientes" on ambientes
  for select using (obra_id in (select get_obras_acesso()));

-- Políticas: FVS Planejadas
create policy "admin_gestor_fvs_planejadas" on fvs_planejadas
  for all using (
    ambiente_id in (
      select a.id from ambientes a
      join obras o on a.obra_id = o.id
      where o.empresa_id = get_empresa_id()
    ) and get_perfil() in ('admin', 'gestor')
  );
create policy "inspetor_fvs_planejadas" on fvs_planejadas
  for select using (
    ambiente_id in (
      select id from ambientes where obra_id in (select get_obras_acesso())
    )
  );

-- Políticas: Verificações
create policy "inspetor_proprias_verificacoes" on verificacoes
  for all using (
    inspetor_id = auth.uid()
    or get_perfil() in ('admin', 'gestor')
  );

-- Políticas: NC
create policy "all_nc_by_obra" on nao_conformidades
  for all using (
    verificacao_id in (
      select v.id from verificacoes v
      join fvs_planejadas fp on v.fvs_planejada_id = fp.id
      join ambientes a on fp.ambiente_id = a.id
      where a.obra_id in (select get_obras_acesso())
    )
  );

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================
create or replace function next_numero_verif(p_fvs_planejada_id uuid)
returns integer as $$
  select coalesce(max(numero_verif), 0) + 1
  from verificacoes
  where fvs_planejada_id = p_fvs_planejada_id
$$ language sql stable;

create or replace function update_fvs_status()
returns trigger as $$
begin
  update fvs_planejadas
  set
    status = new.status,
    concluida_em = case when new.status = 'conforme' then now() else null end,
    updated_at = now()
  where id = new.fvs_planejada_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_update_fvs_status
  after insert or update of status on verificacoes
  for each row execute function update_fvs_status();

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_obras_updated_at        before update on obras            for each row execute function set_updated_at();
create trigger trg_ambientes_updated_at    before update on ambientes         for each row execute function set_updated_at();
create trigger trg_verificacoes_updated_at before update on verificacoes      for each row execute function set_updated_at();
create trigger trg_fvs_padrao_updated_at   before update on fvs_padrao        for each row execute function set_updated_at();
create trigger trg_fvs_plan_updated_at     before update on fvs_planejadas    for each row execute function set_updated_at();
create trigger trg_nc_updated_at           before update on nao_conformidades  for each row execute function set_updated_at();
create trigger trg_usuarios_updated_at     before update on usuarios           for each row execute function set_updated_at();
create trigger trg_equipes_updated_at      before update on equipes            for each row execute function set_updated_at();
