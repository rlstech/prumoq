-- Supports the bounded, tenant-scoped admin lists. RLS remains authoritative;
-- these indexes only avoid scanning another tenant's historical rows before
-- applying the requested sort order.

CREATE INDEX IF NOT EXISTS verificacoes_cliente_data_id_idx
  ON public.verificacoes (cliente_id, data_verif DESC, id DESC);

CREATE INDEX IF NOT EXISTS fvs_padrao_cliente_nome_id_idx
  ON public.fvs_padrao (cliente_id, nome, id);

CREATE INDEX IF NOT EXISTS nao_conformidades_cliente_prazo_id_idx
  ON public.nao_conformidades (cliente_id, data_nova_verif ASC, id ASC);

CREATE INDEX IF NOT EXISTS avaliacoes_empreiteiro_cliente_data_id_idx
  ON public.avaliacoes_empreiteiro (cliente_id, data_avaliacao DESC, id DESC);

CREATE INDEX IF NOT EXISTS medicoes_servico_cliente_data_id_idx
  ON public.medicoes_servico (cliente_id, data_medicao DESC, id DESC);
