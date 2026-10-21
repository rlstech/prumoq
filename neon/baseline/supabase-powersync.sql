-- PowerSync no Supabase: role de replicação (só leitura) e publicação `powersync` com as tabelas do
-- schema local do PWA (apps/mobile/lib/schema.ts) + clientes. Mesma lista do Neon (baseline-teste).
-- A senha NÃO fica aqui: depois deste arquivo, rodar `ALTER ROLE pq_powersync PASSWORD '...'` pela linha de
-- comando e guardar a mesma senha como PS_DATABASE_PASSWORD na instância do PowerSync.
-- A publicação antiga do Supabase (37 tabelas, do app nativo) é substituída.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pq_powersync') THEN
    CREATE ROLE pq_powersync WITH LOGIN REPLICATION BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO pq_powersync;
GRANT SELECT ON
  public.ambientes, public.avaliacao_empreiteiro_itens, public.avaliacao_empreiteiro_reaberturas,
  public.avaliacoes_empreiteiro, public.avancos_aprovados_servico, public.clientes, public.equipes,
  public.fvs_conclusoes, public.fvs_medicao_configuracoes, public.fvs_medicao_etapas, public.fvs_padrao,
  public.fvs_padrao_itens, public.fvs_padrao_revisoes, public.fvs_planejadas, public.fvs_reaberturas,
  public.medicoes_servico, public.modelo_avaliacao_empreiteiro_criterios, public.modelo_avaliacao_empreiteiro_revisoes,
  public.modelos_avaliacao_empreiteiro, public.nao_conformidades, public.nc_fotos, public.nc_reinspecoes,
  public.obra_equipes, public.obra_usuarios, public.obras, public.usuarios, public.verificacao_fotos,
  public.verificacao_itens, public.verificacoes, public.vinculos_execucao_servico
TO pq_powersync;

DROP PUBLICATION IF EXISTS powersync;
CREATE PUBLICATION powersync FOR TABLE
  public.ambientes, public.avaliacao_empreiteiro_itens, public.avaliacao_empreiteiro_reaberturas,
  public.avaliacoes_empreiteiro, public.avancos_aprovados_servico,
  public.clientes (id, nome, slug, status, contato_nome, contato_email, contato_telefone,
                   limite_usuarios, limite_empresas, limite_obras, created_at, updated_at),
  public.equipes, public.fvs_conclusoes, public.fvs_medicao_configuracoes, public.fvs_medicao_etapas,
  public.fvs_padrao, public.fvs_padrao_itens, public.fvs_padrao_revisoes, public.fvs_planejadas,
  public.fvs_reaberturas, public.medicoes_servico, public.modelo_avaliacao_empreiteiro_criterios,
  public.modelo_avaliacao_empreiteiro_revisoes, public.modelos_avaliacao_empreiteiro, public.nao_conformidades,
  public.nc_fotos, public.nc_reinspecoes, public.obra_equipes, public.obra_usuarios, public.obras,
  public.usuarios, public.verificacao_fotos, public.verificacao_itens, public.verificacoes,
  public.vinculos_execucao_servico;

COMMIT;
