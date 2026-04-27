-- Migration 016: Corrige RLS de nc_reinspecoes
-- Problema: políticas com EXISTS encadeando tabelas que também têm RLS
-- (verificacoes, fvs_planejadas, ambientes) causam avaliação aninhada
-- que o Postgres rejeita para INSERT.
-- Solução: INSERT usa apenas inspetor_id = auth.uid() (simples e suficiente).

DROP POLICY IF EXISTS "all_nc_reinspecoes_by_obra" ON nc_reinspecoes;
DROP POLICY IF EXISTS "select_nc_reinspecoes"       ON nc_reinspecoes;
DROP POLICY IF EXISTS "insert_nc_reinspecoes"       ON nc_reinspecoes;

-- SELECT: acesso via verificacao_id da re-inspeção → obra → obra_usuarios
CREATE POLICY "select_nc_reinspecoes" ON nc_reinspecoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM verificacoes v
      JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
      JOIN ambientes a       ON a.id  = fp.ambiente_id
      JOIN obra_usuarios ou  ON ou.obra_id = a.obra_id
      WHERE v.id = nc_reinspecoes.verificacao_id
        AND ou.usuario_id = auth.uid()
        AND ou.ativo = true
    )
  );

-- INSERT: apenas verifica que o inspetor é o próprio usuário logado.
-- EXISTS com JOIN em tabelas RLS-enabled falha em avaliação aninhada.
CREATE POLICY "insert_nc_reinspecoes" ON nc_reinspecoes
  FOR INSERT WITH CHECK (inspetor_id = auth.uid());
