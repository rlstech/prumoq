import { column, Schema, Table } from '@powersync/react-native';

// All columns are text or integer — PowerSync uses SQLite types.
// UUIDs, dates, and enums are stored as text.

const obras = new Table({
  empresa_id:        column.text,
  nome:              column.text,
  eng_responsavel:   column.text,
  crea_cau:          column.text,
  status:            column.text,
  municipio:         column.text,
  uf:                column.text,
  data_inicio_prev:  column.text,
  data_termino_prev: column.text,
  ativo:             column.integer,
  updated_at:        column.text,
});

const obra_usuarios = new Table({
  obra_id:    column.text,
  usuario_id: column.text,
  papel:      column.text,
  ativo:      column.integer,
});

const ambientes = new Table({
  obra_id:     column.text,
  nome:        column.text,
  tipo:        column.text,
  localizacao: column.text,
  observacoes: column.text,
  ativo:       column.integer,
  updated_at:  column.text,
});

const fvs_padrao = new Table({
  empresa_id:    column.text,
  nome:          column.text,
  descricao:     column.text,
  categoria:     column.text,
  norma_ref:     column.text,
  revisao_atual: column.integer,
  ativo:         column.integer,
  created_by:    column.text,
  updated_at:    column.text,
});

const fvs_padrao_revisoes = new Table({
  fvs_padrao_id:  column.text,
  numero_revisao: column.integer,
  descricao_alt:  column.text,
  revisado_por:   column.text,
  created_at:     column.text,
});

const fvs_padrao_itens = new Table({
  fvs_padrao_id: column.text,
  revisao:       column.integer,
  ordem:         column.integer,
  titulo:        column.text,
  metodo_verif:  column.text,
  tolerancia:    column.text,
});

const fvs_planejadas = new Table({
  ambiente_id:       column.text,
  fvs_padrao_id:     column.text,
  revisao_associada: column.integer,
  subservico:        column.text,
  status:            column.text,
  concluida_em:      column.text,
  updated_at:        column.text,
});

const verificacoes = new Table(
  {
    fvs_planejada_id: column.text,
    numero_verif:     column.integer,
    inspetor_id:      column.text,
    equipe_id:        column.text,
    data_verif:       column.text,
    percentual_exec:  column.integer,
    status:           column.text,
    observacoes:      column.text,
    assinatura_url:   column.text,
    assinada_em:      column.text,
    created_offline:  column.integer,
    updated_at:       column.text,
  },
  { indexes: { fvs_planejada: ['fvs_planejada_id'] } }
);

const verificacao_itens = new Table({
  verificacao_id:     column.text,
  fvs_padrao_item_id: column.text,
  ordem:              column.integer,
  titulo:             column.text,
  metodo_verif:       column.text,
  tolerancia:         column.text,
  resultado:          column.text,
});

const verificacao_fotos = new Table({
  verificacao_id: column.text,
  r2_key:         column.text,
  r2_thumb_key:   column.text,
  nome_arquivo:   column.text,
  tamanho_bytes:  column.integer,
  mime_type:      column.text,
  ordem:          column.integer,
});

const nao_conformidades = new Table({
  verificacao_id:        column.text,
  verificacao_item_id:   column.text,
  descricao:             column.text,
  solucao_proposta:      column.text,
  responsavel_id:        column.text,
  data_nova_verif:       column.text,
  prioridade:            column.text,
  status:                column.text,
  resolvida_na_verif_id: column.text,
  resolvida_em:          column.text,
  updated_at:            column.text,
});

const nc_fotos = new Table({
  nc_id:        column.text,
  r2_key:       column.text,
  r2_thumb_key: column.text,
  nome_arquivo: column.text,
  mime_type:    column.text,
  ordem:        column.integer,
});

const equipes = new Table({
  empresa_id:    column.text,
  nome:          column.text,
  tipo:          column.text,
  responsavel:   column.text,
  especialidade: column.text,
  ativo:         column.integer,
});

const usuarios = new Table({
  empresa_id: column.text,
  nome:       column.text,
  cargo:      column.text,
  perfil:     column.text,
  avatar_url: column.text,
});

export const AppSchema = new Schema({
  obras,
  obra_usuarios,
  ambientes,
  fvs_padrao,
  fvs_padrao_revisoes,
  fvs_padrao_itens,
  fvs_planejadas,
  verificacoes,
  verificacao_itens,
  verificacao_fotos,
  nao_conformidades,
  nc_fotos,
  equipes,
  usuarios,
});

// Row types inferred from the schema
export type ObrasRow              = (typeof AppSchema.tables.obras)['$inferSelect'];
export type ObraUsuariosRow       = (typeof AppSchema.tables.obra_usuarios)['$inferSelect'];
export type AmbientesRow          = (typeof AppSchema.tables.ambientes)['$inferSelect'];
export type FvsPadraoRow          = (typeof AppSchema.tables.fvs_padrao)['$inferSelect'];
export type FvsPadraoRevisoesRow  = (typeof AppSchema.tables.fvs_padrao_revisoes)['$inferSelect'];
export type FvsPadraoItensRow     = (typeof AppSchema.tables.fvs_padrao_itens)['$inferSelect'];
export type FvsPlanejdasRow       = (typeof AppSchema.tables.fvs_planejadas)['$inferSelect'];
export type VerificacoesRow       = (typeof AppSchema.tables.verificacoes)['$inferSelect'];
export type VerificacaoItensRow   = (typeof AppSchema.tables.verificacao_itens)['$inferSelect'];
export type VerificacaoFotosRow   = (typeof AppSchema.tables.verificacao_fotos)['$inferSelect'];
export type NaoConformidadesRow   = (typeof AppSchema.tables.nao_conformidades)['$inferSelect'];
export type NcFotosRow            = (typeof AppSchema.tables.nc_fotos)['$inferSelect'];
export type EquipesRow            = (typeof AppSchema.tables.equipes)['$inferSelect'];
export type UsuariosRow           = (typeof AppSchema.tables.usuarios)['$inferSelect'];
