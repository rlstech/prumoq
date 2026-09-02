import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import * as FileSystem from 'expo-file-system';
import { createEvidenceThumbnail } from './image-normalizer';
import { supabase } from './supabase';
import { classifyUploadFailure, quarantineOperation } from './sync-quarantine';

const PENDING_PREFIX = 'pending:';
/** Mensagem unica: `classifyUploadFailure` a reconhece como falha definitiva. */
const MEDIA_MISSING = 'Pending media file is unavailable or empty';
/** Tentativas de uma mesma operacao antes de manda-la para a quarentena. */
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

export class SupabaseConnector implements PowerSyncBackendConnector {
  private uploadedMedia = new Map<string, string>();
  /** Tentativas por operacao, para que falha transitoria nao vire eterna. */
  private attempts = new Map<string, number>();
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      throw new Error('No active Supabase session');
    }

    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL!,
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        // `data` e mutado por processOperation: e nele que `pending:<caminho>`
        // vira a chave definitiva do R2. Fica declarado aqui fora para que a
        // quarentena guarde o payload JA resolvido — o arquivo local e apagado
        // ao final da transacao, entao um payload com `pending:` seria
        // impossivel de reenviar depois.
        const data: Record<string, unknown> = { ...(op.opData ?? {}) };
        const opKey = `${op.op}:${op.table}:${op.id}`;
        try {
          await this.processOperation(op, data);
          this.attempts.delete(opKey);
        } catch (error) {
          // Uma linha que o servidor recusa em definitivo não pode segurar a
          // fila: ela sai para a quarentena (visível em Perfil > Sincronizacao)
          // e as gravações seguintes continuam subindo. Falha transitória
          // relança, e o PowerSync repete a transação inteira.
          const attempt = (this.attempts.get(opKey) ?? 0) + 1;
          this.attempts.set(opKey, attempt);

          const failure = classifyUploadFailure(error);
          // Rede instavel merece repeticao; repeticao infinita, nao. Sem este
          // teto, um erro local nao previsto (arquivo sumido, biblioteca
          // lancando algo generico) volta a congelar a fila para sempre — que e
          // exatamente o defeito que a quarentena existe para eliminar.
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
      for (const localPath of this.uploadedMedia.keys()) {
        // The reusable source must survive sync; document snapshots can be
        // discarded because their R2 key is already persisted remotely.
        if (!localPath.includes('/prumoq-signatures/') || localPath.includes('/snapshots/')) {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
        }
      }
      this.uploadedMedia.clear();
    } catch (error) {
      console.error('[PowerSync] uploadData error:', error);
      throw error; // Let PowerSync retry
    }
  }

  private async processOperation(op: CrudEntry, data: Record<string, unknown>): Promise<void> {
    const table = op.table;

    // Resolve pending photo uploads before writing to Supabase
    await this.ensureThumbnail(table, data);
    for (const field of MEDIA_FIELDS[table] ?? []) {
      await this.resolvePendingMedia(data, field);
    }

    switch (op.op) {
      case UpdateType.PUT:
        await this.upsertRow(table, { id: op.id, ...data });
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
    const localPath = source.slice(PENDING_PREFIX.length);

    // Sem esta checagem o ImageManipulator lanca um erro generico, que a
    // classificacao trata como transitorio — e a operacao volta a cada retry
    // sem nunca chegar ao servidor, congelando a fila em silencio. O arquivo
    // some quando a transacao anterior e concluida, entao o caso e real.
    const info = await FileSystem.getInfoAsync(localPath, { size: true });
    if (!info.exists || !info.size) throw new Error(MEDIA_MISSING);

    const thumbnailPath = await createEvidenceThumbnail(localPath);
    data.r2_thumb_key = `${PENDING_PREFIX}${thumbnailPath}`;
  }

  /**
   * If r2_key starts with 'pending:', uploads the local file to R2
   * via presigned URL and replaces r2_key with the final cloud key.
   */
  private async resolvePendingMedia(data: Record<string, unknown>, field: string): Promise<void> {
    const r2Key = data[field] as string | undefined;
    if (!r2Key?.startsWith(PENDING_PREFIX)) return;

    const localPath = r2Key.slice(PENDING_PREFIX.length);
    const cachedKey = this.uploadedMedia.get(localPath);
    if (cachedKey) {
      data[field] = cachedKey;
      return;
    }
    const isSignature = field.includes('assinatura');
    const filename = localPath.split('/').pop() ?? (isSignature ? 'signature.png' : 'photo.jpg');
    const mimeType = (data['mime_type'] as string | undefined) ?? (isSignature ? 'image/png' : 'image/jpeg');
    const fileInfo = await FileSystem.getInfoAsync(localPath, { size: true });
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error(MEDIA_MISSING);
    }

    // Get presigned URL from Edge Function
    const { data: { session } } = await supabase.auth.getSession();
    const presignRes = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/r2-presign`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ filename, contentType: mimeType, contentLength: fileInfo.size }),
      }
    );

    if (!presignRes.ok) {
      throw new Error(`Presign failed: ${presignRes.status}`);
    }

    const { uploadUrl: url, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

    // Read file and upload directly to R2
    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: binary,
    });

    if (!uploadRes.ok) {
      throw new Error(`R2 upload failed: ${uploadRes.status}`);
    }

    // Replace pending path with final R2 key, clean up local file
    data[field] = key;
    this.uploadedMedia.set(localPath, key);
  }

  private async upsertRow(table: string, data: Record<string, unknown>): Promise<void> {
    if (table === 'avancos_aprovados_servico') {
      const { error } = await supabase.from(table).insert(data as never);
      // PowerSync may retry a PUT after the server committed but before the
      // client received confirmation. The immutable UUID makes 23505 a safe,
      // idempotent acknowledgement; the DB trigger rejects mismatched payloads.
      if (error && error.code !== '23505') throw error;
      return;
    }
    // NUNCA usar upsert aqui. O `upsert` do supabase-js vira
    // `INSERT ... ON CONFLICT`, e com ON CONFLICT o PostgreSQL passa a exigir
    // também a policy de SELECT sobre a linha proposta. As policies de leitura
    // deste schema consultam a propria tabela — `verificacoes_select` e
    // `has_verificacao_access(id)` fazem EXISTS(SELECT 1 FROM verificacoes
    // WHERE id = ...) — e para uma linha nova isso e falso por definicao. O
    // resultado era 42501 ("new row violates row-level security policy") em
    // toda verificacao criada no aparelho, travando a fila inteira.
    //
    // Reproduzido no banco: mesmo payload e mesma autenticacao, INSERT puro
    // passa, ON CONFLICT DO UPDATE e ON CONFLICT DO NOTHING falham.
    //
    // PowerSync emite PUT para insercao local e PATCH para alteracao, entao o
    // INSERT e o caminho certo. O 23505 so aparece em reenvio de uma operacao
    // que o servidor ja aplicou sem que o cliente confirmasse; nesse caso vale
    // atualizar, para nao perder os campos do reenvio.
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

  private async patchRow(table: string, id: string, data: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from(table as never).update(data as never).eq('id', id);
    if (error) throw error;
  }

  private async deleteRow(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table as never).delete().eq('id', id);
    if (error) throw error;
  }
}
