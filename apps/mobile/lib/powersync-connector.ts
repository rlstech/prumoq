import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/common';
import { MidiaAguardandoEnvio, PENDING_PREFIX, envioMidia } from './media-upload';
import { supabase } from './supabase';
import { isConnectivityFailure } from './sync-failure';
import { classifyUploadFailure, quarantineOperation } from './sync-quarantine';

/**
 * Quem fornece o token do PowerSync (JWT template `powersync` do Clerk). Fica plugável para este módulo
 * não depender da camada de login (lib/auth/sessao.tsx registra o getter).
 */
export type PowerSyncTokenGetter = () => Promise<string | null>;

let tokenGetter: PowerSyncTokenGetter | null = null;

export function setPowerSyncTokenGetter(getter: PowerSyncTokenGetter | null): void {
  tokenGetter = getter;
}

/**
 * Cadência de envio: o padrão do PowerSync (5 s) martelava a API quando o servidor recusava uma gravação
 * (visto no app nativo). Mantido do connector antigo.
 */
export const SYNC_OPTIONS = {
  crudUploadThrottleMs: 20_000,
  retryDelayMs: 20_000,
};

/** Alteração que não encontrou a linha no servidor — ver `patchRow`. */
const ROW_MISSING = 'O registro não existe no servidor';
/** Tentativas de uma mesma operação antes de mandá-la para a quarentena. */
const MAX_TRANSIENT_ATTEMPTS = 5;

const MEDIA_FIELDS: Record<string, string[]> = {
  verificacao_fotos: ['r2_key', 'r2_thumb_key'],
  nc_fotos: ['r2_key', 'r2_thumb_key'],
  verificacoes: ['assinatura_url'],
  fvs_conclusoes: ['assinatura_url'],
  avaliacoes_empreiteiro: ['assinatura_url'],
  usuarios: ['assinatura_padrao_url'],
  nc_reinspecoes: ['foto_url'],
  nao_conformidades: ['foto_reinspecao_url'],
};

/**
 * Campos que o aparelho altera só para a tela refletir o resultado na hora, mesmo offline. No servidor
 * quem os mantém são triggers (status da FVS a partir de verificações, conclusões e reaberturas), e a RLS
 * nem deixa o inspetor alterar `fvs_planejadas`: enviados, iriam para a quarentena. A versão do servidor
 * chega pela sincronização e substitui a local.
 */
const LOCAL_ONLY_FIELDS: Record<string, readonly string[]> = {
  fvs_planejadas: ['status', 'concluida_em', 'ultima_conclusao_em', 'ultima_reabertura_em'],
};

export class PrumoqConnector implements PowerSyncBackendConnector {
  /** Cache por transação: referência local -> chave do R2, evita subir duas vezes. */
  private uploadedMedia = new Map<string, string>();
  /**
   * Mídia local que pode ser apagada porque a linha que a referencia foi ACEITA pelo servidor. Apagar ao
   * subir o binário perdia a evidência quando a linha era recusada logo depois.
   */
  private confirmedMedia = new Set<string>();
  /** Tentativas por operação, para que falha transitória não vire eterna. */
  private attempts = new Map<string, number>();

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
    if (!endpoint) throw new Error('EXPO_PUBLIC_POWERSYNC_URL não configurada');
    // Sem sessão (ou offline): null faz o PowerSync tentar de novo depois, sem perder nada local.
    const token = tokenGetter ? await tokenGetter() : null;
    if (!token) return null;
    return { endpoint, token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    // Só envia com a sessão da pessoa dona dos dados (o mesmo getter do PowerSync). Sem ela, a fila espera.
    if (!tokenGetter || !(await tokenGetter())) throw new Error('Sem sessão para enviar as gravações');

    try {
      for (const op of transaction.crud) {
        // `data` é mutado por processOperation: é nele que `pending:<ref>` vira a chave do R2. A quarentena
        // guarda o payload JÁ resolvido, porque a cópia local é apagada ao fim da transação.
        const data: Record<string, unknown> = { ...(op.opData ?? {}) };
        const opKey = `${op.op}:${op.table}:${op.id}`;
        const opMedia = new Set<string>();
        try {
          await this.processOperation(op, data, opMedia);
          for (const ref of opMedia) this.confirmedMedia.add(ref);
          this.attempts.delete(opKey);
        } catch (error) {
          // Sem internet ou mídia aguardando: a fila espera na ordem, sem contar tentativa.
          if (error instanceof MidiaAguardandoEnvio || isConnectivityFailure(error)) throw error;

          // Uma linha que o servidor recusa em definitivo não pode segurar a fila: vai para a quarentena
          // (Perfil > Sincronização) e o resto continua. Falha transitória relança e o PowerSync repete.
          const attempt = (this.attempts.get(opKey) ?? 0) + 1;
          this.attempts.set(opKey, attempt);
          const failure = classifyUploadFailure(error);
          const exhausted = attempt >= MAX_TRANSIENT_ATTEMPTS;
          if (!failure.permanent && !exhausted) throw error;
          console.warn(
            `[PowerSync] operação em quarentena após ${attempt} tentativa(s):`,
            `${op.op} ${op.table} ${op.id} — ${failure.code} — ${failure.message}`,
          );
          await quarantineOperation(
            database,
            op,
            failure.permanent
              ? failure
              : { ...failure, message: `${failure.message} (após ${attempt} tentativas)` },
            data,
          );
          this.attempts.delete(opKey);
        }
      }
      await transaction.complete();
      for (const ref of this.confirmedMedia) {
        await envioMidia().descartar(ref).catch(() => undefined);
      }
    } catch (error) {
      if (!(error instanceof MidiaAguardandoEnvio) && !isConnectivityFailure(error)) {
        console.error('[PowerSync] uploadData error:', error);
      }
      throw error; // o PowerSync tenta de novo depois
    } finally {
      this.uploadedMedia.clear();
      this.confirmedMedia.clear();
    }
  }

  private async processOperation(op: CrudEntry, data: Record<string, unknown>, opMedia: Set<string>): Promise<void> {
    const table = op.table;

    for (const field of LOCAL_ONLY_FIELDS[table] ?? []) delete data[field];
    if (op.op === UpdateType.PATCH && Object.keys(data).length === 0) return;

    await this.ensureThumbnail(table, data);
    for (const field of MEDIA_FIELDS[table] ?? []) {
      await this.resolvePendingMedia(data, field, opMedia);
    }

    switch (op.op) {
      case UpdateType.PUT:
        await this.insertRow(table, { id: op.id, ...data });
        break;
      case UpdateType.PATCH:
        await this.patchRow(table, op.id, data);
        break;
      case UpdateType.DELETE:
        await this.deleteRow(table, op.id);
        break;
    }
  }

  private async ensureThumbnail(table: string, data: Record<string, unknown>): Promise<void> {
    if (table !== 'verificacao_fotos' && table !== 'nc_fotos') return;
    const source = data.r2_key as string | undefined;
    if (!source?.startsWith(PENDING_PREFIX) || data.r2_thumb_key) return;
    const thumb = await envioMidia().miniatura(source.slice(PENDING_PREFIX.length));
    data.r2_thumb_key = `${PENDING_PREFIX}${thumb}`;
  }

  /** Troca `pending:<ref>` pela chave do R2, subindo o arquivo local. */
  private async resolvePendingMedia(data: Record<string, unknown>, field: string, opMedia: Set<string>): Promise<void> {
    const value = data[field] as string | undefined;
    if (!value?.startsWith(PENDING_PREFIX)) return;

    const ref = value.slice(PENDING_PREFIX.length);
    opMedia.add(ref);
    const cached = this.uploadedMedia.get(ref);
    if (cached) {
      data[field] = cached;
      return;
    }
    const isSignature = field.includes('assinatura');
    const mimeType = (data.mime_type as string | undefined) ?? (isSignature ? 'image/png' : 'image/jpeg');
    const key = await envioMidia().enviar(ref, { campo: field, mimeType });
    data[field] = key;
    this.uploadedMedia.set(ref, key);
  }

  private async insertRow(table: string, data: Record<string, unknown>): Promise<void> {
    if (table === 'avancos_aprovados_servico') {
      const { error } = await supabase.from(table).insert(data as never);
      // Reenvio de um PUT que o servidor já aplicou: o UUID imutável torna o 23505 uma confirmação
      // idempotente; o trigger do banco recusa payload divergente.
      if (error && error.code !== '23505') throw error;
      return;
    }
    // NUNCA usar upsert aqui: `INSERT ... ON CONFLICT` passa a exigir também a policy de SELECT sobre a
    // linha proposta, e as policies de leitura deste schema consultam a própria tabela (falso para uma
    // linha nova) — 42501 em toda verificação criada no aparelho. O PowerSync emite PUT para inserção
    // local, então INSERT é o caminho; o 23505 só aparece em reenvio, e aí vale atualizar.
    const { id, ...fields } = data;
    const { error } = await supabase.from(table as never).insert(data as never);
    if (!error) return;
    if (error.code !== '23505') throw error;

    const { error: updateError } = await supabase
      .from(table as never)
      .update(fields as never)
      .eq('id', id as string);
    if (updateError) throw updateError;
  }

  /**
   * `count: 'exact'` não é detalhe: um UPDATE que não encontra a linha (inexistente ou barrada pela RLS)
   * responde 204 e passaria por sucesso, perdendo a alteração em silêncio. Sem linha alvo, a alteração vai
   * para a quarentena.
   */
  private async patchRow(table: string, id: string, data: Record<string, unknown>): Promise<void> {
    const { error, count } = await supabase
      .from(table as never)
      .update(data as never, { count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error(ROW_MISSING);
  }

  private async deleteRow(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table as never).delete().eq('id', id);
    if (error) throw error;
  }
}
