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

// Row types — manual interfaces matching the SQLite columns above
// (PowerSync's Schema class does not expose per-table TypeScript types)
export interface ObrasRow {
  id: string; empresa_id: string; nome: string; eng_responsavel: string;
  crea_cau: string; status: string; municipio: string; uf: string;
  data_inicio_prev: string; data_termino_prev: string; ativo: number; updated_at: string;
}
export interface ObraUsuariosRow { id: string; obra_id: string; usuario_id: string; papel: string; ativo: number }
export interface AmbientesRow { id: string; obra_id: string; nome: string; tipo: string; localizacao: string; observacoes: string; ativo: number; updated_at: string }
export interface FvsPadraoRow { id: string; empresa_id: string; nome: string; descricao: string; categoria: string; norma_ref: string; revisao_atual: number; ativo: number; created_by: string; updated_at: string }
export interface FvsPadraoRevisoesRow { id: string; fvs_padrao_id: string; numero_revisao: number; descricao_alt: string; revisado_por: string; created_at: string }
export interface FvsPadraoItensRow { id: string; fvs_padrao_id: string; revisao: number; ordem: number; titulo: string; metodo_verif: string; tolerancia: string }
export interface FvsPlanejdasRow { id: string; ambiente_id: string; fvs_padrao_id: string; revisao_associada: number; subservico: string; status: string; concluida_em: string; updated_at: string }
export interface VerificacoesRow { id: string; fvs_planejada_id: string; numero_verif: number; inspetor_id: string; equipe_id: string; data_verif: string; percentual_exec: number; status: string; observacoes: string; assinatura_url: string; assinada_em: string; created_offline: number; updated_at: string }
export interface VerificacaoItensRow { id: string; verificacao_id: string; fvs_padrao_item_id: string; ordem: number; titulo: string; metodo_verif: string; tolerancia: string; resultado: string }
export interface VerificacaoFotosRow { id: string; verificacao_id: string; r2_key: string; r2_thumb_key: string; nome_arquivo: string; tamanho_bytes: number; mime_type: string; ordem: number }
export interface NaoConformidadesRow { id: string; verificacao_id: string; verificacao_item_id: string; descricao: string; solucao_proposta: string; responsavel_id: string; data_nova_verif: string; prioridade: string; status: string; resolvida_na_verif_id: string; resolvida_em: string; updated_at: string }
export interface NcFotosRow { id: string; nc_id: string; r2_key: string; r2_thumb_key: string; nome_arquivo: string; mime_type: string; ordem: number }
export interface EquipesRow { id: string; empresa_id: string; nome: string; tipo: string; responsavel: string; especialidade: string; ativo: number }
export interface UsuariosRow { id: string; empresa_id: string; nome: string; cargo: string; perfil: string; avatar_url: string }
