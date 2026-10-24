import type { Database } from '@prumoq/shared';

/** Um item (serviço/FVS) do contrato, somando etapas e trocas de empreiteiro dentro dele. */
export type ServiceRow = {
  fvsId: string;
  ambienteId: string;
  ambiente: string;
  servico: string;
  unidade: string;
  metodo: Database['public']['Enums']['metodo_medicao_servico'];
  preco: number | null;
  /** Quantidade no contrato: escopo dos vínculos ativos + aprovado congelado dos substituídos. */
  previsto: number;
  aprovado: number;
  medido: number;
  liberado: number;
  bloqueado: number;
  valorLiberado: number;
  /** Soma do valor das medições aprovadas (preço do momento da medição). */
  valorMedido: number;
  /** Menor quantidade aceita num aditivo (não pode ficar abaixo do aprovado em campo). */
  minQuantidade: number;
  podeMudarQuantidade: boolean;
};

export type AmendmentItem = {
  fvsId: string;
  servico: string;
  tipo: 'inclusao' | 'alteracao';
  unidade: string;
  quantidadeAnterior: number;
  quantidadeNova: number;
  precoAnterior: number | null;
  precoNovo: number | null;
};

export type Amendment = {
  id: string;
  numero: number;
  descricao: string;
  data: string;
  valorAnterior: number;
  valorNovo: number;
  autor: string | null;
  createdAt: string;
  itens: AmendmentItem[];
};

export type HistoryEvent = { id: string; quando: string; autor: string | null; texto: string; detalhe: string | null };
