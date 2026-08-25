import type {
  NcDraftDetail,
  VerificationResult,
} from '../../lib/verification/draft.types';

/** Result of a checklist item. Alias kept for readability at call sites. */
export type Resultado = VerificationResult;

export interface ItemRow {
  id: string;
  ordem: number;
  titulo: string;
  metodo_verif: string;
  tolerancia: string;
}

export interface EquipeRow {
  id: string;
  nome: string;
  tipo: string;
}

export interface ManagerRow {
  id: string;
  nome: string;
}

export interface FeatureRow {
  controle_medicoes_efetivo: number;
  controle_financeiro_nc_efetivo: number;
}

export interface MeasurementLinkRow {
  id: string;
  etapa_id: string | null;
  equipe_id: string;
  equipe_nome: string;
  etapa_nome: string | null;
  escopo_atribuido: string;
  unidade: string;
  permite_avanco_parcial: number;
  executado_atual: string;
  aprovado_atual: string;
}

export interface FvsRow {
  id: string;
  subservico: string;
  revisao_associada: number;
  status: string;
}

export interface UsuarioRow {
  id: string;
  cliente_id: string;
  nome: string;
  cargo: string;
  perfil: 'superadmin' | 'admin' | 'gestor' | 'inspetor';
}

export interface CountRow {
  count: number;
}

export interface NcAbertaRow {
  nc_id: string;
  fvs_padrao_item_id: string;
  titulo: string;
  descricao: string;
  numero_ocorrencia: number;
  data_nova_verif: string | null;
  responsavel_id: string | null;
  numero_verif: number;
  nc_data_criacao: string;
  financeiro_requerido: number;
  situacao_financeira: string | null;
}

export interface UltimaVerifItemRow {
  fvs_padrao_item_id: string;
  resultado: string;
}

export type NcDetail = NcDraftDetail;

/** Per-item NC field errors, already resolved from the flat `nc_*_<itemId>`
 * error map so ChecklistItemRow/NcInlineForm don't reach into raw keys. */
export interface NcFieldErrors {
  descricao?: string;
  foto?: string;
  solucao?: string;
  data?: string;
  responsavel?: string;
  financeiro?: string;
}

export type ReinspResult =
  | { type: 'idle' }
  | {
      type: 'aprovada';
      itemTitle: string;
      abertoEm: string | null;
      resolvidoEm: string;
      responsavelNome: string | null;
      fotoUri: string | null;
    }
  | {
      type: 'reprovada';
      ocorrencia: number;
      ncAnteriorId: string;
      ncAnteriorDescricao: string;
      ncAnteriorVerifNum: number;
      ncAnteriorDataCriacao: string;
      verificacaoId: string;
      verificacaoItemId: string;
    };

/** The single checklist stop the inspector should be looking at: an open NC
 * always wins, otherwise the first unclassified item. Undefined once every
 * item is classified — a finished checklist has no next stop.
 * Shared by the route rail and the checklist rows so the Cal Viva focus marker
 * can never point at two different items. */
export function getRoutePriorityId(
  items: readonly ItemRow[],
  itemResults: Readonly<Record<string, Resultado>>,
  openNcs: readonly NcAbertaRow[],
): string | undefined {
  return openNcs[0]?.fvs_padrao_item_id
    ?? items.find(item => !itemResults[item.id])?.id;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
}

/** Formats an ISO 'YYYY-MM-DD' as 'DD/MM' without a timezone-shifting Date
 * parse — the checklist strip only needs the short day/month label. */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  if (!day || !month) return iso;
  return `${day}/${month}`;
}

/** Rounds to 6 decimal places (matches numeric(18,6) in Postgres) to avoid
 * floating point artifacts when summing a delta onto an accumulated total. */
export function measurementTotal(previous: string, delta: string): number {
  return Math.round(((Number(previous) || 0) + (Number(delta) || 0)) * 1e6) / 1e6;
}

/** Strips the 'pending:' prefix used to mark media not yet uploaded to R2,
 * so a raw draft URI can be rendered before/without going through R2. */
export function stripPendingPrefix(uri: string): string {
  return uri.startsWith('pending:') ? uri.slice(8) : uri;
}
