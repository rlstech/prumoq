import { column, Schema, Table } from '@powersync/react-native';

// All columns are text or integer — PowerSync uses SQLite types.
// UUIDs, dates, and enums are stored as text.

const obras = new Table({
  cliente_id:       column.text,
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
  controle_medicoes_efetivo: column.integer,
  controle_financeiro_nc_efetivo: column.integer,
  updated_at:        column.text,
});

const obra_usuarios = new Table({
  cliente_id: column.text,
  obra_id:    column.text,
  usuario_id: column.text,
  papel:      column.text,
  ativo:      column.integer,
});

const obra_equipes = new Table({
  cliente_id: column.text,
  obra_id:   column.text,
  equipe_id: column.text,
});

const ambientes = new Table(
  {
    cliente_id: column.text,
    obra_id:     column.text,
    nome:        column.text,
    tipo:        column.text,
    localizacao: column.text,
    observacoes: column.text,
    ativo:       column.integer,
    updated_at:  column.text,
  },
  { indexes: { obra: ['obra_id'] } }
);

const fvs_padrao = new Table({
  cliente_id:    column.text,
  escopo:        column.text,
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
  cliente_id:     column.text,
  fvs_padrao_id:  column.text,
  numero_revisao: column.integer,
  descricao_alt:  column.text,
  revisado_por:   column.text,
  created_at:     column.text,
});

const fvs_padrao_itens = new Table({
  cliente_id:    column.text,
  fvs_padrao_id: column.text,
  revisao:       column.integer,
  ordem:         column.integer,
  titulo:        column.text,
  metodo_verif:  column.text,
  tolerancia:    column.text,
});

const fvs_planejadas = new Table({
  cliente_id:           column.text,
  ambiente_id:          column.text,
  fvs_padrao_id:        column.text,
  revisao_associada:    column.integer,
  subservico:           column.text,
  status:               column.text,
  percentual_exec:      column.integer,
  concluida_em:         column.text,
  total_conclusoes:     column.integer,
  total_reaberturas:    column.integer,
  ultima_conclusao_em:  column.text,
  ultima_reabertura_em: column.text,
  updated_at:           column.text,
});

const fvs_conclusoes = new Table(
  {
    cliente_id:      column.text,
    fvs_planejada_id: column.text,
    verificacao_id:   column.text,
    inspetor_id:      column.text,
    numero_conclusao: column.integer,
    percentual_final: column.integer,
    resultado:        column.text,
    motivo_antes_100: column.text,
    tipo_motivo:      column.text,
    observacao_final: column.text,
    assinatura_url:   column.text,
    assinada_em:      column.text,
    created_at:       column.text,
  },
  { indexes: { fvs_planejada: ['fvs_planejada_id'] } }
);

const fvs_reaberturas = new Table(
  {
    cliente_id:       column.text,
    fvs_planejada_id:  column.text,
    solicitado_por:    column.text,
    autorizado_por:    column.text,
    motivo_tipo:       column.text,
    justificativa:     column.text,
    numero_reabertura: column.integer,
    created_at:        column.text,
  },
  { indexes: { fvs_planejada: ['fvs_planejada_id'] } }
);

const verificacoes = new Table(
  {
    cliente_id:      column.text,
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
    created_at:       column.text,
    updated_at:       column.text,
  },
  { indexes: { fvs_planejada: ['fvs_planejada_id'] } }
);

const verificacao_itens = new Table(
  {
    cliente_id:        column.text,
    verificacao_id:     column.text,
    fvs_padrao_item_id: column.text,
    ordem:              column.integer,
    titulo:             column.text,
    metodo_verif:       column.text,
    tolerancia:         column.text,
    resultado:          column.text,
  },
  { indexes: { verificacao: ['verificacao_id'] } }
);

const verificacao_fotos = new Table(
  {
    cliente_id:    column.text,
    verificacao_id: column.text,
    r2_key:         column.text,
    r2_thumb_key:   column.text,
    nome_arquivo:   column.text,
    tamanho_bytes:  column.integer,
    mime_type:      column.text,
    ordem:          column.integer,
  },
  { indexes: { verificacao: ['verificacao_id'] } }
);

const nao_conformidades = new Table(
  {
    cliente_id:             column.text,
    verificacao_id:        column.text,
    verificacao_item_id:   column.text,
    descricao:             column.text,
    solucao_proposta:      column.text,
    responsavel_id:        column.text,
    data_nova_verif:       column.text,
    prioridade:            column.text,
    status:                column.text,
    numero_ocorrencia:     column.integer,
    nc_anterior_id:        column.text,
    verificacao_reinsp_id: column.text,
    foto_reinspecao_url:   column.text,
    resolvida_na_verif_id: column.text,
    resolvida_em:          column.text,
    observacao_resolucao:  column.text,
    financeiro_requerido: column.integer,
    situacao_financeira: column.text,
    justificativa_sem_impacto: column.text,
    responsavel_avaliacao_id: column.text,
    prazo_avaliacao: column.text,
    valor_estimado: column.text,
    valor_confirmado: column.text,
    responsavel_financeiro: column.text,
    categoria_financeira: column.text,
    observacao_financeira: column.text,
    documento_financeiro_r2_key: column.text,
    bloqueio_medicao: column.text,
    quantidade_bloqueada: column.text,
    percentual_bloqueado: column.text,
    valor_bloqueado: column.text,
    created_at:            column.text,
    updated_at:            column.text,
  },
  { indexes: {
      verificacao: ['verificacao_id'],
      status:      ['status'],
  }}
);

const nc_reinspecoes = new Table({
  cliente_id:     column.text,
  nc_id:          column.text,
  verificacao_id: column.text,
  inspetor_id:    column.text,
  resultado:      column.text,
  observacao:     column.text,
  foto_url:       column.text,
  nova_nc_id:     column.text,
  created_at:     column.text,
});

const nc_fotos = new Table({
  cliente_id:   column.text,
  nc_id:        column.text,
  r2_key:       column.text,
  r2_thumb_key: column.text,
  nome_arquivo: column.text,
  mime_type:    column.text,
  ordem:        column.integer,
});

const equipes = new Table({
  cliente_id:    column.text,
  escopo:        column.text,
  nome:          column.text,
  tipo:          column.text,
  responsavel:   column.text,
  especialidade: column.text,
  cnpj_terceiro: column.text,
  ativo:         column.integer,
});

const usuarios = new Table({
  cliente_id:              column.text,
  nome:                    column.text,
  cargo:                   column.text,
  perfil:                  column.text,
  avatar_url:              column.text,
  assinatura_padrao_url:   column.text,
  assinatura_padrao_atualizada_em: column.text,
  onboarding_concluido_em: column.text,
});

const fvs_medicao_configuracoes = new Table({
  cliente_id: column.text, fvs_planejada_id: column.text, metodo: column.text,
  unidade: column.text, quantidade_total: column.text, preco_unitario: column.text,
  permite_medicoes_parciais: column.integer, modelo_origem_id: column.text,
});
const fvs_medicao_etapas = new Table({
  cliente_id: column.text, configuracao_id: column.text, ordem: column.integer,
  nome: column.text, peso_percentual: column.text, permite_avanco_parcial: column.integer,
  ativo: column.integer,
  status: column.text, percentual_interno: column.text,
  equipe_responsavel_id: column.text, verificacao_evidencia_id: column.text,
  updated_by: column.text, updated_at: column.text,
});
const vinculos_execucao_servico = new Table({
  cliente_id: column.text, fvs_planejada_id: column.text, etapa_id: column.text,
  equipe_id: column.text, data_inicio: column.text, data_termino: column.text,
  escopo_atribuido: column.text, status: column.text,
});
const avancos_aprovados_servico = new Table({
  cliente_id: column.text, vinculacao_id: column.text, verificacao_id: column.text,
  etapa_id: column.text, executado_anterior: column.text, executado_atual: column.text,
  aprovado_anterior: column.text, aprovado_atual: column.text, unidade: column.text,
  aprovado_por: column.text, data_aprovacao: column.text,
  created_offline: column.integer, created_at: column.text,
});
const medicoes_servico = new Table({
  cliente_id: column.text, obra_id: column.text, equipe_id: column.text, referencia: column.text,
  periodo_inicio: column.text, periodo_fim: column.text, data_medicao: column.text, status: column.text,
});
const modelos_avaliacao_empreiteiro = new Table({
  cliente_id: column.text, empresa_id: column.text, nome: column.text, descricao: column.text,
  revisao_atual: column.integer, ativo: column.integer,
});
const modelo_avaliacao_empreiteiro_revisoes = new Table({
  cliente_id: column.text, modelo_id: column.text, numero_revisao: column.integer, descricao_alteracoes: column.text,
});
const modelo_avaliacao_empreiteiro_criterios = new Table({
  cliente_id: column.text, revisao_id: column.text, ordem: column.integer, titulo: column.text, peso: column.integer,
});
const avaliacoes_empreiteiro = new Table({
  cliente_id: column.text, obra_id: column.text, equipe_id: column.text, medicao_id: column.text,
  modelo_revisao_id: column.text, data_avaliacao: column.text, notificacoes_ocorridas: column.text,
  providencias_tomadas: column.text, pontos_obtidos: column.text, pontos_possiveis: column.text,
  percentual: column.text, status: column.text, avaliador_id: column.text, assinatura_url: column.text,
  assinada_em: column.text, concluida_em: column.text, aprovada_por: column.text, aprovada_em: column.text, invalidada_por: column.text, invalidada_em: column.text,
  motivo_invalidacao: column.text, ultimo_motivo_reabertura: column.text, created_offline: column.integer, created_at: column.text, updated_at: column.text,
}, { indexes: { obra: ['obra_id'], medicao: ['medicao_id'] } });
const avaliacao_empreiteiro_itens = new Table({
  cliente_id: column.text, avaliacao_id: column.text, criterio_origem_id: column.text, ordem: column.integer,
  titulo: column.text, peso: column.integer, resultado: column.text, comentario_nao_atende: column.text,
}, { indexes: { avaliacao: ['avaliacao_id'] } });
const avaliacao_empreiteiro_reaberturas = new Table({
  cliente_id: column.text, avaliacao_id: column.text, avaliador_anterior_id: column.text,
  reaberto_por: column.text, motivo: column.text, numero_reabertura: column.integer, created_at: column.text,
}, { indexes: { avaliacao: ['avaliacao_id'] } });

export const AppSchema = new Schema({
  obras,
  obra_usuarios,
  obra_equipes,
  ambientes,
  fvs_padrao,
  fvs_padrao_revisoes,
  fvs_padrao_itens,
  fvs_planejadas,
  fvs_conclusoes,
  fvs_reaberturas,
  verificacoes,
  verificacao_itens,
  verificacao_fotos,
  nao_conformidades,
  nc_fotos,
  nc_reinspecoes,
  equipes,
  usuarios,
  fvs_medicao_configuracoes,
  fvs_medicao_etapas,
  vinculos_execucao_servico,
  avancos_aprovados_servico,
  medicoes_servico,
  modelos_avaliacao_empreiteiro,
  modelo_avaliacao_empreiteiro_revisoes,
  modelo_avaliacao_empreiteiro_criterios,
  avaliacoes_empreiteiro,
  avaliacao_empreiteiro_itens,
  avaliacao_empreiteiro_reaberturas,
});

// Row types — manual interfaces matching the SQLite columns above
// (PowerSync's Schema class does not expose per-table TypeScript types)
export interface TenantRow { cliente_id: string }
export interface ObrasRow extends TenantRow {
  id: string; empresa_id: string; nome: string; eng_responsavel: string;
  crea_cau: string; status: string; municipio: string; uf: string;
  data_inicio_prev: string; data_termino_prev: string; ativo: number; controle_medicoes_efetivo: number; controle_financeiro_nc_efetivo: number; updated_at: string;
}
export interface ObraUsuariosRow extends TenantRow { id: string; obra_id: string; usuario_id: string; papel: string; ativo: number }
export interface ObraEquipesRow extends TenantRow { id: string; obra_id: string; equipe_id: string }
export interface AmbientesRow extends TenantRow { id: string; obra_id: string; nome: string; tipo: string; localizacao: string; observacoes: string; ativo: number; updated_at: string }
export interface FvsPadraoRow extends TenantRow { id: string; escopo: string; nome: string; descricao: string; categoria: string; norma_ref: string; revisao_atual: number; ativo: number; created_by: string; updated_at: string }
export interface FvsPadraoRevisoesRow { id: string; fvs_padrao_id: string; numero_revisao: number; descricao_alt: string; revisado_por: string; created_at: string }
export interface FvsPadraoItensRow { id: string; fvs_padrao_id: string; revisao: number; ordem: number; titulo: string; metodo_verif: string; tolerancia: string }
export interface FvsPlanejdasRow { id: string; ambiente_id: string; fvs_padrao_id: string; revisao_associada: number; subservico: string; status: string; percentual_exec: number; concluida_em: string; total_conclusoes: number; total_reaberturas: number; ultima_conclusao_em: string; ultima_reabertura_em: string; updated_at: string }
export interface FvsConclusoesRow { id: string; fvs_planejada_id: string; verificacao_id: string | null; inspetor_id: string; numero_conclusao: number; percentual_final: number; resultado: string; motivo_antes_100: string; tipo_motivo: string; observacao_final: string; assinatura_url: string; assinada_em: string; created_at: string }
export interface FvsReaberturasRow { id: string; fvs_planejada_id: string; solicitado_por: string; autorizado_por: string; motivo_tipo: string; justificativa: string; numero_reabertura: number; created_at: string }
export interface VerificacoesRow { id: string; fvs_planejada_id: string; numero_verif: number; inspetor_id: string; equipe_id: string; data_verif: string; percentual_exec: number; status: string; observacoes: string; assinatura_url: string; assinada_em: string; created_offline: number; created_at: string; updated_at: string }
export interface VerificacaoItensRow { id: string; verificacao_id: string; fvs_padrao_item_id: string; ordem: number; titulo: string; metodo_verif: string; tolerancia: string; resultado: string }
export interface VerificacaoFotosRow { id: string; verificacao_id: string; r2_key: string; r2_thumb_key: string; nome_arquivo: string; tamanho_bytes: number; mime_type: string; ordem: number }
export interface NaoConformidadesRow { id: string; verificacao_id: string; verificacao_item_id: string; descricao: string; solucao_proposta: string; responsavel_id: string | null; data_nova_verif: string; prioridade: string; status: string; numero_ocorrencia: number; nc_anterior_id: string | null; verificacao_reinsp_id: string | null; foto_reinspecao_url: string | null; resolvida_na_verif_id: string | null; resolvida_em: string | null; observacao_resolucao: string | null; financeiro_requerido: number; situacao_financeira: string | null; justificativa_sem_impacto: string | null; responsavel_avaliacao_id: string | null; prazo_avaliacao: string | null; valor_estimado: string | null; valor_confirmado: string | null; responsavel_financeiro: string | null; categoria_financeira: string | null; observacao_financeira: string | null; documento_financeiro_r2_key: string | null; bloqueio_medicao: string | null; quantidade_bloqueada: string | null; percentual_bloqueado: string | null; valor_bloqueado: string | null; created_at: string; updated_at: string }
export interface FvsMedicaoConfiguracaoRow extends TenantRow { id: string; fvs_planejada_id: string; metodo: string; unidade: string; quantidade_total: string; preco_unitario: string | null; permite_medicoes_parciais: number }
export interface FvsMedicaoEtapaRow extends TenantRow { id: string; configuracao_id: string; ordem: number; nome: string; peso_percentual: string; permite_avanco_parcial: number; ativo: number }
export interface VinculoExecucaoServicoRow extends TenantRow { id: string; fvs_planejada_id: string; etapa_id: string | null; equipe_id: string; escopo_atribuido: string; status: string }
export interface AvancoAprovadoServicoRow extends TenantRow { id: string; vinculacao_id: string; verificacao_id: string; etapa_id: string | null; executado_anterior: string; executado_atual: string; aprovado_anterior: string; aprovado_atual: string; unidade: string }
export interface MedicaoServicoRow extends TenantRow { id:string; obra_id:string; equipe_id:string; referencia:string; periodo_inicio:string; periodo_fim:string; data_medicao:string; status:string }
export interface ModeloAvaliacaoEmpreiteiroRow extends TenantRow { id:string; empresa_id:string|null; nome:string; descricao:string|null; revisao_atual:number; ativo:number }
export interface ModeloAvaliacaoRevisaoRow extends TenantRow { id:string; modelo_id:string; numero_revisao:number; descricao_alteracoes:string }
export interface ModeloAvaliacaoCriterioRow extends TenantRow { id:string; revisao_id:string; ordem:number; titulo:string; peso:number }
export interface AvaliacaoEmpreiteiroRow extends TenantRow { id:string; obra_id:string; equipe_id:string; medicao_id:string|null; modelo_revisao_id:string; data_avaliacao:string; status:string; avaliador_id:string; assinatura_url:string|null; percentual:string; pontos_obtidos:string; pontos_possiveis:string; notificacoes_ocorridas:string|null; providencias_tomadas:string|null; ultimo_motivo_reabertura:string|null }
export interface AvaliacaoEmpreiteiroItemRow extends TenantRow { id:string; avaliacao_id:string; criterio_origem_id:string|null; ordem:number; titulo:string; peso:number; resultado:string|null; comentario_nao_atende:string|null }
export interface AvaliacaoEmpreiteiroReaberturaRow extends TenantRow { id:string; avaliacao_id:string; avaliador_anterior_id:string; reaberto_por:string; motivo:string; numero_reabertura:number; created_at:string }
export interface NcFotosRow { id: string; nc_id: string; r2_key: string; r2_thumb_key: string | null; nome_arquivo: string | null; mime_type: string | null; ordem: number }
export interface NcReinspecoesRow { id: string; nc_id: string; verificacao_id: string; inspetor_id: string; resultado: 'aprovada' | 'reprovada'; observacao: string | null; foto_url: string | null; nova_nc_id: string | null; created_at: string }
export interface EquipesRow extends TenantRow { id: string; escopo: string; nome: string; tipo: string; responsavel: string; especialidade: string; ativo: number }
export interface UsuariosRow extends TenantRow { id: string; nome: string; cargo: string; perfil: string; avatar_url: string; onboarding_concluido_em: string | null }
