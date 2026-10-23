-- PowerSync: coluna obra_id derivada nas tabelas "profundas".
--
-- Por quê: no PowerSync (Sync Streams), um filtro por subconsulta encadeada
-- (ex.: verificacao_itens.verificacao_id IN (SELECT v.id ... WHERE obra_id IN minhas_obras))
-- cria um bucket por registro pai (um por verificação, um por FVS...), não um por obra.
-- Um admin com 5 obras já passou do limite de 1000 resultados de parâmetro (PSYNC_S2305).
-- Com obra_id na própria linha, cada stream filtra `obra_id IN minhas_obras` e o bucket é por obra.
--
-- A coluna é DERIVADA do pai e mantida só por trigger: o valor enviado pelo cliente é ignorado.
-- Não há FK para obras (o apagamento já desce pela cadeia de FKs existente).
-- Limite conhecido: se um ambiente mudar de obra, os descendentes não são recalculados
-- (o app não faz isso hoje). Ver powersync/sync-config.yaml.

BEGIN;

-- 1) Colunas -------------------------------------------------------------------------------
ALTER TABLE public.fvs_planejadas                     ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_conclusoes                     ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_reaberturas                    ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_medicao_configuracoes          ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.vinculos_execucao_servico          ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.verificacoes                       ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.fvs_medicao_etapas                 ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.avancos_aprovados_servico          ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.verificacao_itens                  ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.verificacao_fotos                  ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.nao_conformidades                  ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.nc_fotos                           ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.nc_reinspecoes                     ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.avaliacao_empreiteiro_itens        ADD COLUMN IF NOT EXISTS obra_id uuid;
ALTER TABLE public.avaliacao_empreiteiro_reaberturas  ADD COLUMN IF NOT EXISTS obra_id uuid;

-- 2) Trigger que deriva obra_id do pai -----------------------------------------------------
-- SECURITY DEFINER: a busca no pai não pode depender da RLS de quem grava.
-- Os campos de NEW são resolvidos em tempo de execução, então cada ramo só toca
-- colunas que existem na tabela daquele ramo.
CREATE OR REPLACE FUNCTION public.set_obra_id_derivado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'fvs_planejadas' THEN
      SELECT a.obra_id INTO NEW.obra_id FROM ambientes a WHERE a.id = NEW.ambiente_id;
    WHEN 'fvs_conclusoes', 'fvs_reaberturas', 'fvs_medicao_configuracoes',
         'vinculos_execucao_servico', 'verificacoes' THEN
      SELECT fp.obra_id INTO NEW.obra_id FROM fvs_planejadas fp WHERE fp.id = NEW.fvs_planejada_id;
    WHEN 'fvs_medicao_etapas' THEN
      SELECT c.obra_id INTO NEW.obra_id FROM fvs_medicao_configuracoes c WHERE c.id = NEW.configuracao_id;
    WHEN 'avancos_aprovados_servico' THEN
      SELECT v.obra_id INTO NEW.obra_id FROM vinculos_execucao_servico v WHERE v.id = NEW.vinculacao_id;
    WHEN 'verificacao_itens', 'verificacao_fotos', 'nao_conformidades' THEN
      SELECT v.obra_id INTO NEW.obra_id FROM verificacoes v WHERE v.id = NEW.verificacao_id;
    WHEN 'nc_fotos', 'nc_reinspecoes' THEN
      SELECT nc.obra_id INTO NEW.obra_id FROM nao_conformidades nc WHERE nc.id = NEW.nc_id;
    WHEN 'avaliacao_empreiteiro_itens', 'avaliacao_empreiteiro_reaberturas' THEN
      SELECT a.obra_id INTO NEW.obra_id FROM avaliacoes_empreiteiro a WHERE a.id = NEW.avaliacao_id;
  END CASE;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.set_obra_id_derivado() FROM PUBLIC;

-- `trg_00_` para rodar antes dos outros BEFORE (a ordem é alfabética).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fvs_planejadas', 'fvs_conclusoes', 'fvs_reaberturas', 'fvs_medicao_configuracoes',
    'vinculos_execucao_servico', 'verificacoes', 'fvs_medicao_etapas', 'avancos_aprovados_servico',
    'verificacao_itens', 'verificacao_fotos', 'nao_conformidades', 'nc_fotos', 'nc_reinspecoes',
    'avaliacao_empreiteiro_itens', 'avaliacao_empreiteiro_reaberturas'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_00_obra_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_00_obra_id BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_derivado()', t);
  END LOOP;
END
$$;

-- 3) Preenchimento das linhas existentes ---------------------------------------------------
-- Com os triggers de usuário desligados por tabela: o UPDATE não pode recalcular progresso,
-- gerar auditoria, mexer em updated_at nem esbarrar na imutabilidade dos avanços aprovados.
-- (O Neon não permite session_replication_role.) Ordem: pais antes dos filhos.
CREATE OR REPLACE FUNCTION pg_temp.preencher(p_tabela text, p_sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', p_tabela);
  EXECUTE p_sql;
  EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', p_tabela);
END
$$;

SELECT pg_temp.preencher('fvs_planejadas',
  'UPDATE fvs_planejadas t SET obra_id = a.obra_id FROM ambientes a WHERE a.id = t.ambiente_id AND t.obra_id IS DISTINCT FROM a.obra_id');
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = fp.obra_id FROM fvs_planejadas fp WHERE fp.id = t.fvs_planejada_id AND t.obra_id IS DISTINCT FROM fp.obra_id', tb))
FROM unnest(ARRAY['fvs_conclusoes', 'fvs_reaberturas', 'fvs_medicao_configuracoes',
                  'vinculos_execucao_servico', 'verificacoes']) AS tb;
SELECT pg_temp.preencher('fvs_medicao_etapas',
  'UPDATE fvs_medicao_etapas t SET obra_id = c.obra_id FROM fvs_medicao_configuracoes c WHERE c.id = t.configuracao_id AND t.obra_id IS DISTINCT FROM c.obra_id');
SELECT pg_temp.preencher('avancos_aprovados_servico',
  'UPDATE avancos_aprovados_servico t SET obra_id = v.obra_id FROM vinculos_execucao_servico v WHERE v.id = t.vinculacao_id AND t.obra_id IS DISTINCT FROM v.obra_id');
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = v.obra_id FROM verificacoes v WHERE v.id = t.verificacao_id AND t.obra_id IS DISTINCT FROM v.obra_id', tb))
FROM unnest(ARRAY['verificacao_itens', 'verificacao_fotos', 'nao_conformidades']) AS tb;
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = nc.obra_id FROM nao_conformidades nc WHERE nc.id = t.nc_id AND t.obra_id IS DISTINCT FROM nc.obra_id', tb))
FROM unnest(ARRAY['nc_fotos', 'nc_reinspecoes']) AS tb;
SELECT pg_temp.preencher(tb, format(
  'UPDATE %I t SET obra_id = a.obra_id FROM avaliacoes_empreiteiro a WHERE a.id = t.avaliacao_id AND t.obra_id IS DISTINCT FROM a.obra_id', tb))
FROM unnest(ARRAY['avaliacao_empreiteiro_itens', 'avaliacao_empreiteiro_reaberturas']) AS tb;

-- 4) Índices (consultas do painel por obra e a própria checagem de consistência) ----------
CREATE INDEX IF NOT EXISTS idx_fvs_planejadas_obra_id            ON public.fvs_planejadas (obra_id);
CREATE INDEX IF NOT EXISTS idx_verificacoes_obra_id              ON public.verificacoes (obra_id);
CREATE INDEX IF NOT EXISTS idx_verificacao_itens_obra_id         ON public.verificacao_itens (obra_id);
CREATE INDEX IF NOT EXISTS idx_nao_conformidades_obra_id         ON public.nao_conformidades (obra_id);

COMMIT;
