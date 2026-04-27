import { db } from '../lib/powersync';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface NcCreateParams {
  verificacaoId: string;
  verificacaoItemId: string;
  descricao: string;
  solucao_proposta: string;
  responsavel_id: string | null;
  data_nova_verif: string;
  /** Caminho local da foto (sem prefixo pending:). Null se não houver. */
  foto_local_path: string | null;
  /** Preenchido quando esta NC é gerada após reprovação (RN-NC-05). */
  nc_anterior_id?: string | null;
  /** Padrão 1 para primeira ocorrência. >= 2 eleva prioridade para alta. */
  numero_ocorrencia?: number;
}

export interface ReinspecaoAprovadaParams {
  ncId: string;
  verificacaoId: string;
  inspetorId: string;
  /** URL da foto obrigatória da re-inspeção. */
  fotoUrl: string | null;
  observacao?: string | null;
}

export interface ReinspecaoReprovadaParams {
  ncId: string;
  /** numero_ocorrencia da NC sendo encerrada — passado pelo caller a partir da query. */
  numeroOcorrenciaAtual: number;
  verificacaoId: string;
  inspetorId: string;
  fotoUrl: string | null;
  observacao?: string | null;
}

// ─── RN-NC-01 ────────────────────────────────────────────────────────────────

/**
 * Cria uma NC quando item é marcado como nao_conforme.
 * Também usada pelo caller após reprovação para criar a NC sucessora (RN-NC-05).
 * Retorna o id da NC criada.
 */
export async function createNc(params: NcCreateParams): Promise<string> {
  const ncId = uuid();
  const now = new Date().toISOString();
  const numeroOcorrencia = params.numero_ocorrencia ?? 1;
  // RN-NC-01: prioridade sobe automaticamente a partir da 2ª ocorrência
  const prioridade = numeroOcorrencia >= 2 ? 'alta' : 'media';

  await db.execute(
    `INSERT INTO nao_conformidades
       (id, verificacao_id, verificacao_item_id, descricao, solucao_proposta,
        responsavel_id, data_nova_verif, status, numero_ocorrencia,
        nc_anterior_id, prioridade, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ncId,
      params.verificacaoId,
      params.verificacaoItemId,
      params.descricao,
      params.solucao_proposta,
      params.responsavel_id ?? null,
      params.data_nova_verif,
      'aberta',
      numeroOcorrencia,
      params.nc_anterior_id ?? null,
      prioridade,
      now,
    ],
  );

  if (params.foto_local_path) {
    await db.execute(
      `INSERT INTO nc_fotos (id, nc_id, r2_key, nome_arquivo, mime_type, ordem)
       VALUES (?, ?, ?, ?, 'image/jpeg', 0)`,
      [
        uuid(),
        ncId,
        `pending:${params.foto_local_path}`,
        params.foto_local_path.split('/').pop() ?? 'nc.jpg',
      ],
    );
  }

  return ncId;
}

// ─── RN-NC-04 ────────────────────────────────────────────────────────────────

/**
 * Item que estava em NC agora está conforme na re-inspeção.
 * Registra nc_reinspecoes (aprovada) e muda NC para resolvida.
 */
export async function approveReinspecao(
  params: ReinspecaoAprovadaParams,
): Promise<void> {
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO nc_reinspecoes
       (id, nc_id, verificacao_id, inspetor_id, resultado, observacao, foto_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      params.ncId,
      params.verificacaoId,
      params.inspetorId,
      'aprovada',
      params.observacao ?? null,
      params.fotoUrl ?? null,
      now,
    ],
  );

  await db.execute(
    `UPDATE nao_conformidades SET
       status = ?, resolvida_em = ?, verificacao_reinsp_id = ?, foto_reinspecao_url = ?, updated_at = ?
     WHERE id = ?`,
    ['resolvida', now, params.verificacaoId, params.fotoUrl ?? null, now, params.ncId],
  );
}

// ─── RN-NC-05 ────────────────────────────────────────────────────────────────

/**
 * Item ainda nao_conforme na re-inspeção.
 * Registra nc_reinspecoes (reprovada) + encerra NC anterior.
 *
 * O caller deve em seguida chamar createNc() com:
 *   nc_anterior_id = params.ncId
 *   numero_ocorrencia = proximaOcorrencia
 *
 * Retorna proximaOcorrencia para o caller compor a nova NC.
 */
export async function reprovarReinspecao(
  params: ReinspecaoReprovadaParams,
): Promise<{ proximaOcorrencia: number }> {
  const now = new Date().toISOString();
  const proximaOcorrencia = params.numeroOcorrenciaAtual + 1;

  await db.execute(
    `INSERT INTO nc_reinspecoes
       (id, nc_id, verificacao_id, inspetor_id, resultado, observacao, foto_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      params.ncId,
      params.verificacaoId,
      params.inspetorId,
      'reprovada',
      params.observacao ?? null,
      params.fotoUrl ?? null,
      now,
    ],
  );

  await db.execute(
    `UPDATE nao_conformidades SET status = ?, updated_at = ? WHERE id = ?`,
    ['encerrada_sem_resolucao', now, params.ncId],
  );

  return { proximaOcorrencia };
}
