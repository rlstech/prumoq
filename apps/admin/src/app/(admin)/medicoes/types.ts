import type { Database } from '@prumoq/shared';

export type Contract = Database['public']['Tables']['contratos']['Row'];
export type ContractSummary = Database['public']['Views']['vw_resumo_contratos']['Row'];
export type Work = { id: string; nome: string; controle_medicoes_efetivo: boolean };
export type Team = { id: string; nome: string };
export type WorkTeam = { obra_id: string; equipe_id: string };
