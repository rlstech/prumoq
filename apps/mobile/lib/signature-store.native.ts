import * as FileSystem from 'expo-file-system';
import type { SignatureStore } from './signature-store';

const ROOT = `${FileSystem.documentDirectory}prumoq-signatures/`;

function defaultPath(userId: string) {
  return `${ROOT}${encodeURIComponent(userId)}/default.png`;
}

function snapshotPath(userId: string, documentId: string) {
  return `${ROOT}${encodeURIComponent(userId)}/snapshots/${encodeURIComponent(documentId)}.png`;
}

export const signatureStore: SignatureStore = {
  async save(userId, sourceUri) {
    const destination = defaultPath(userId);
    await FileSystem.makeDirectoryAsync(`${ROOT}${encodeURIComponent(userId)}/`, { intermediates: true });
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    return destination;
  },
  async get(userId) {
    const path = defaultPath(userId);
    return (await FileSystem.getInfoAsync(path)).exists ? path : null;
  },
  async snapshot(userId, documentId) {
    const source = await this.get(userId);
    if (!source) return null;
    const destination = snapshotPath(userId, documentId);
    await FileSystem.makeDirectoryAsync(`${ROOT}${encodeURIComponent(userId)}/snapshots/`, { intermediates: true });
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.copyAsync({ from: source, to: destination });
    return { uri: destination };
  },
  async restoreFromRemote(userId, downloadUri) {
    const destination = defaultPath(userId);
    await FileSystem.makeDirectoryAsync(`${ROOT}${encodeURIComponent(userId)}/`, { intermediates: true });
    const result = await FileSystem.downloadAsync(downloadUri, destination);
    return result.status === 200 ? destination : null;
  },
  async clear(userId) {
    await FileSystem.deleteAsync(`${ROOT}${encodeURIComponent(userId)}/`, { idempotent: true });
  },
};
