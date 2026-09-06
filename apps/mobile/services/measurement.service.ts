import { db } from '../lib/powersync';
import type { SqlExecutor } from '../lib/sql-executor';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, value => {
    const random = (Math.random() * 16) | 0;
    return (value === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export interface MeasurementAdvanceInput {
  clienteId: string;
  verificacaoId: string;
  vinculoId: string;
  etapaId: string | null;
  executadoAnterior: string;
  executadoAtual: string;
  aprovadoAnterior: string;
  aprovadoAtual: string;
  unidade: string;
  aprovadoPor: string;
}

export async function recordApprovedAdvances(
  inputs: readonly MeasurementAdvanceInput[],
  exec: SqlExecutor = db,
): Promise<void> {
  for (const input of inputs) {
    if (Number(input.executadoAtual) === Number(input.executadoAnterior)
      && Number(input.aprovadoAtual) === Number(input.aprovadoAnterior)) continue;
    await exec.execute(
      `INSERT INTO avancos_aprovados_servico
        (id, cliente_id, vinculacao_id, verificacao_id, etapa_id,
         executado_anterior, executado_atual, aprovado_anterior, aprovado_atual,
         unidade, aprovado_por, data_aprovacao, created_offline, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), input.clienteId, input.vinculoId, input.verificacaoId, input.etapaId,
        input.executadoAnterior, input.executadoAtual, input.aprovadoAnterior, input.aprovadoAtual,
        input.unidade, input.aprovadoPor, new Date().toISOString(), 1, new Date().toISOString()],
    );
  }
}
