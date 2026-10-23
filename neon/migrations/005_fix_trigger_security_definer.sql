-- ============================================================
-- Migration 005: fix update_fvs_status trigger security
-- ============================================================
-- O trigger update_fvs_status executa UPDATE em fvs_planejadas, mas a
-- política RLS do inspetor só permite SELECT nessa tabela. Como a função
-- do trigger não era SECURITY DEFINER, ela rodava com as permissões do
-- usuário chamador (inspetor) e o UPDATE era silenciosamente bloqueado
-- pelo RLS — mantendo o status sempre em 'pendente'.
--
-- Solução: recriar a função com SECURITY DEFINER para que rode com
-- permissões do owner (postgres), bypassando o RLS.
-- ============================================================

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
$$ language plpgsql security definer;
