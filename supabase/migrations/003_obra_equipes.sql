-- ============================================================
-- Migração 003: Tabela de junção obra_equipes
-- Vincula equipes a obras específicas
-- ============================================================

create table if not exists obra_equipes (
  id          uuid primary key default uuid_generate_v4(),
  obra_id     uuid not null references obras(id) on delete cascade,
  equipe_id   uuid not null references equipes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(obra_id, equipe_id)
);

-- RLS
alter table obra_equipes enable row level security;

create policy "obra_equipes_select" on obra_equipes
  for select using (true);

create policy "obra_equipes_insert" on obra_equipes
  for insert with check (true);

create policy "obra_equipes_delete" on obra_equipes
  for delete using (true);
