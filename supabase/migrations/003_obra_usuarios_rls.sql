-- Políticas RLS faltantes para obra_usuarios
-- A tabela tinha RLS habilitado mas nenhuma policy, bloqueando
-- qualquer leitura direta (exceto via funções security definer).

create policy "usuario_le_proprias_obras" on obra_usuarios
  for select using (usuario_id = auth.uid());

create policy "admin_gestor_gerencia_obra_usuarios" on obra_usuarios
  for all using (get_perfil() in ('admin', 'gestor'));
