-- Migration 015: Corrige RLS de nc_reinspecoes para INSERT
-- O FOR ALL USING sem WITH CHECK falha no INSERT porque a subconsulta
-- lê nao_conformidades (que também tem RLS), criando avaliação aninhada
-- que o Postgres rejeita. Separamos em políticas SELECT e INSERT explícitas.

DROP POLICY IF EXISTS "all_nc_reinspecoes_by_obra" ON nc_reinspecoes;

-- Leitura: mesma lógica de antes
CREATE POLICY "select_nc_reinspecoes" ON nc_reinspecoes
  FOR SELECT USING (
    nc_id IN (
      SELECT nc.id FROM nao_conformidades nc
      JOIN verificacoes v ON nc.verificacao_id = v.id
      JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
      JOIN ambientes a ON fp.ambiente_id = a.id
      WHERE a.obra_id IN (SELECT get_obras_acesso())
    )
  );

-- Inserção: usa JOIN direto em obra_usuarios (evita RLS aninhado)
CREATE POLICY "insert_nc_reinspecoes" ON nc_reinspecoes
  FOR INSERT WITH CHECK (
    inspetor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM nao_conformidades nc
      JOIN verificacoes v ON nc.verificacao_id = v.id
      JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
      JOIN ambientes a ON fp.ambiente_id = a.id
      JOIN obra_usuarios ou ON ou.obra_id = a.obra_id
      WHERE nc.id = nc_reinspecoes.nc_id
        AND ou.usuario_id = auth.uid()
        AND ou.ativo = true
    )
  );
