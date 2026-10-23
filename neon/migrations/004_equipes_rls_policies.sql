-- ============================================================
-- Políticas RLS para tabelas sem policies (equipes, fvs_padrao, etc.)
-- ============================================================

-- Políticas: Equipes
create policy "admin_gestor_all_equipes" on equipes
  for all using (
    get_perfil() in ('admin', 'gestor')
    and empresa_id = get_empresa_id()
  );

create policy "inspetor_equipes_select" on equipes
  for select using (
    empresa_id = get_empresa_id()
  );

-- Políticas: FVS Padrão
create policy "admin_gestor_fvs_padrao" on fvs_padrao
  for all using (
    get_perfil() in ('admin', 'gestor')
    and empresa_id = get_empresa_id()
  );

create policy "inspetor_fvs_padrao_select" on fvs_padrao
  for select using (
    empresa_id = get_empresa_id()
  );

-- Políticas: FVS Padrão Revisões
create policy "admin_gestor_fvs_padrao_revisoes" on fvs_padrao_revisoes
  for all using (
    get_perfil() in ('admin', 'gestor')
    and fvs_padrao_id in (
      select id from fvs_padrao where empresa_id = get_empresa_id()
    )
  );

create policy "inspetor_fvs_padrao_revisoes_select" on fvs_padrao_revisoes
  for select using (
    fvs_padrao_id in (
      select id from fvs_padrao where empresa_id = get_empresa_id()
    )
  );

-- Políticas: FVS Padrão Itens
create policy "admin_gestor_fvs_padrao_itens" on fvs_padrao_itens
  for all using (
    get_perfil() in ('admin', 'gestor')
    and revisao_id in (
      select r.id from fvs_padrao_revisoes r
      join fvs_padrao f on r.fvs_padrao_id = f.id
      where f.empresa_id = get_empresa_id()
    )
  );

create policy "inspetor_fvs_padrao_itens_select" on fvs_padrao_itens
  for select using (
    revisao_id in (
      select r.id from fvs_padrao_revisoes r
      join fvs_padrao f on r.fvs_padrao_id = f.id
      where f.empresa_id = get_empresa_id()
    )
  );

-- Políticas: Verificação Itens
create policy "verificacao_itens_acesso" on verificacao_itens
  for all using (
    verificacao_id in (
      select v.id from verificacoes v
      join fvs_planejadas fp on v.fvs_planejada_id = fp.id
      join ambientes a on fp.ambiente_id = a.id
      where a.obra_id in (select get_obras_acesso())
    )
  );

-- Políticas: Verificação Fotos
create policy "verificacao_fotos_acesso" on verificacao_fotos
  for all using (
    verificacao_id in (
      select v.id from verificacoes v
      join fvs_planejadas fp on v.fvs_planejada_id = fp.id
      join ambientes a on fp.ambiente_id = a.id
      where a.obra_id in (select get_obras_acesso())
    )
  );
