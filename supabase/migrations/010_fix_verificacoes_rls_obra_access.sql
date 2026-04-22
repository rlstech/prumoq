-- Fix: inspetores devem ver verificações de todos os inspetores nas obras que acessam,
-- não apenas as próprias. Consistente com a policy de NCs (all_nc_by_obra).

DROP POLICY IF EXISTS "inspetor_proprias_verificacoes" ON verificacoes;

CREATE POLICY "verificacoes_by_obra" ON verificacoes
  FOR ALL USING (
    inspetor_id = auth.uid()
    OR fvs_planejada_id IN (
      SELECT fp.id FROM fvs_planejadas fp
      JOIN ambientes a ON fp.ambiente_id = a.id
      WHERE a.obra_id IN (SELECT get_obras_acesso())
    )
  );