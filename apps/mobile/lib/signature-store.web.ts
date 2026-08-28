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
  async snapshot(userId) {
    const blob = await storedBlob(userId);
    return blob ? { uri: URL.createObjectURL(blob.slice(0, blob.size, 'image/png')) } : null;
  },
  async clear(userId) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(userId);
    await transactionDone(transaction);
    database.close();
  },
};
