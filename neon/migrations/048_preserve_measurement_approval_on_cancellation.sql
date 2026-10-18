-- A cancelled bulletin remains historically approved. The original constraint
-- incorrectly required approved_at to become NULL as soon as status changed to
-- cancelled, which made the supported cancellation RPC impossible to execute.
ALTER TABLE public.medicoes_servico
  DROP CONSTRAINT IF EXISTS medicoes_servico_check1;

ALTER TABLE public.medicoes_servico
  ADD CONSTRAINT medicoes_servico_aprovacao_historica_check
  CHECK (
    (
      status = 'rascunho'
      AND aprovado_em IS NULL
      AND aprovado_por IS NULL
    )
    OR
    (
      status IN ('aprovada', 'cancelada')
      AND aprovado_em IS NOT NULL
      AND aprovado_por IS NOT NULL
    )
  );
