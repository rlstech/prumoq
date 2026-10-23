import type { SignatureStore } from './signature-store';

const DB_NAME = 'prumoq-signatures';
const STORE = 'signatures';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponível'));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento local'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha no armazenamento local'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Armazenamento local cancelado'));
  });
}

async function storedBlob(userId: string): Promise<Blob | null> {
  const database = await openDatabase();
  const value = await result(database.transaction(STORE, 'readonly').objectStore(STORE).get(userId) as IDBRequest<Blob | undefined>);
  database.close();
  return value ?? null;
}

export const signatureStore: SignatureStore = {
  async save(userId, sourceUri) {
    const response = await fetch(sourceUri);
    if (!response.ok) throw new Error('Não foi possível guardar a assinatura padrão.');
    const blob = await response.blob();
    const database = await openDatabase();
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(blob, userId);
    await transactionDone(transaction);
    database.close();
    return URL.createObjectURL(blob);
  },
  async get(userId) {
    const blob = await storedBlob(userId);
    return blob ? URL.createObjectURL(blob) : null;
  },
  // A cópia vai para a linha da verificação/avaliação como `pending:`: precisa sobreviver a um recarregamento
  // da página até subir ao R2, por isso `data:` URL e não `blob:` (ver pending-media.web.ts).
  async snapshot(userId) {
    const blob = await storedBlob(userId);
    if (!blob) return null;
    const uri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a assinatura.'));
      reader.readAsDataURL(blob.slice(0, blob.size, 'image/png'));
    });
    return { uri };
  },
  async restoreFromRemote(userId, downloadUri) {
    try {
      return await this.save(userId, downloadUri);
    } catch {
      return null;
    }
  },
  async clear(userId) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(userId);
    await transactionDone(transaction);
    database.close();
  },
};
