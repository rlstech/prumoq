import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import * as FileSystem from 'expo-file-system';
import { createEvidenceThumbnail } from './image-normalizer';
import { supabase } from './supabase';

const PENDING_PREFIX = 'pending:';
const MEDIA_FIELDS: Record<string, string[]> = {
  verificacao_fotos: ['r2_key', 'r2_thumb_key'],
  nc_fotos: ['r2_key', 'r2_thumb_key'],
  verificacoes: ['assinatura_url'],
  fvs_conclusoes: ['assinatura_url'],
  nc_reinspecoes: ['foto_url'],
  nao_conformidades: ['foto_reinspecao_url'],
};

export class SupabaseConnector implements PowerSyncBackendConnector {
  private uploadedMedia = new Map<string, string>();
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
        await this.processOperation(op);
      }
      await transaction.complete();
      for (const localPath of this.uploadedMedia.keys()) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      }
      this.uploadedMedia.clear();
    } catch (error) {
      console.error('[PowerSync] uploadData error:', error);
      throw error; // Let PowerSync retry
    }
  }

  private async processOperation(op: CrudEntry): Promise<void> {
    const table = op.table;
    const data = { ...(op.opData ?? {}) };

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
    const thumbnailPath = await createEvidenceThumbnail(source.slice(PENDING_PREFIX.length));
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
    const isSignature = field === 'assinatura_url';
    const filename = localPath.split('/').pop() ?? (isSignature ? 'signature.png' : 'photo.jpg');
    const mimeType = (data['mime_type'] as string | undefined) ?? (isSignature ? 'image/png' : 'image/jpeg');
    const fileInfo = await FileSystem.getInfoAsync(localPath, { size: true });
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error('Pending media file is unavailable or empty');
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
    const { error } = await supabase.from(table as never).upsert(data as never);
    if (error) throw error;
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
