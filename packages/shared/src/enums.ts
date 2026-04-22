// All PostgreSQL enums from schema.sql as TypeScript const objects.
// Use these for type-safe comparisons in both apps.

export const PerfilUsuario = {
  admin:    'admin',
  gestor:   'gestor',
  inspetor: 'inspetor',
} as const;
export type PerfilUsuario = (typeof PerfilUsuario)[keyof typeof PerfilUsuario];

export const TipoAmbiente = {
  interno: 'interno',
  externo: 'externo',
} as const;
export type TipoAmbiente = (typeof TipoAmbiente)[keyof typeof TipoAmbiente];

export const StatusObra = {
  naoIniciada: 'nao_iniciada',
  emAndamento: 'em_andamento',
  paralisada:  'paralisada',
  concluida:   'concluida',
} as const;
export type StatusObra = (typeof StatusObra)[keyof typeof StatusObra];

export const StatusFvs = {
  pendente:          'pendente',
  emAndamento:       'em_andamento',
  conforme:          'conforme',
  naoConforme:       'nao_conforme',
  concluida:         'concluida',
  emRevisao:         'em_revisao',
  concluidaRessalva: 'concluida_ressalva',
} as const;
export type StatusFvs = (typeof StatusFvs)[keyof typeof StatusFvs];

export const MotivoReabertura = {
  reclamacaoCliente:       'reclamacao_cliente',
  auditoriaInterna:        'auditoria_interna',
  servicoComplementar:     'servico_complementar',
  correcaoRegistro:        'correcao_registro',
  determinacaoEngenharia:  'determinacao_engenharia',
  outro:                   'outro',
} as const;
export type MotivoReabertura = (typeof MotivoReabertura)[keyof typeof MotivoReabertura];

export const MotivoConclusaoAntecipada = {
  escopoConformeprojeto:   'escopo_conforme_projeto',
  escopoAlterado:         'escopo_alterado',
  responsabilidadeOutra:  'responsabilidade_outra',
  decisaoTecnica:         'decisao_tecnica',
  outro:                  'outro',
} as const;
export type MotivoConclusaoAntecipada = (typeof MotivoConclusaoAntecipada)[keyof typeof MotivoConclusaoAntecipada];

export const ResultadoConclusao = {
  aprovado:    'aprovado',
  comRessalva: 'com_ressalva',
} as const;
export type ResultadoConclusao = (typeof ResultadoConclusao)[keyof typeof ResultadoConclusao];

export const ResultadoItem = {
  conforme:    'conforme',
  naoConforme: 'nao_conforme',
  na:          'na',
} as const;
export type ResultadoItem = (typeof ResultadoItem)[keyof typeof ResultadoItem];

export const StatusNc = {
  aberta:     'aberta',
  emCorrecao: 'em_correcao',
  resolvida:  'resolvida',
  cancelada:  'cancelada',
} as const;
export type StatusNc = (typeof StatusNc)[keyof typeof StatusNc];

export const TipoEquipe = {
  proprio:      'proprio',
  terceirizado: 'terceirizado',
} as const;
export type TipoEquipe = (typeof TipoEquipe)[keyof typeof TipoEquipe];

export const CategoriaFvs = {
  estrutura:     'estrutura',
  vedacao:       'vedacao',
  revestimento:  'revestimento',
  instalacoes:   'instalacoes',
  cobertura:     'cobertura',
  acabamento:    'acabamento',
  fundacao:      'fundacao',
  terraplanagem: 'terraplanagem',
  outro:         'outro',
} as const;
export type CategoriaFvs = (typeof CategoriaFvs)[keyof typeof CategoriaFvs];

export const PrioridadeNc = {
  alta:  'alta',
  media: 'media',
  baixa: 'baixa',
} as const;
export type PrioridadeNc = (typeof PrioridadeNc)[keyof typeof PrioridadeNc];
