import {
  applyHydratedMedia,
  DraftMediaRef,
  DraftMediaSource,
  DraftStore,
  sanitizeDraftState,
  VerificationDraftV1,
} from './draft.types';

const DB_NAME = 'prumoq-field';
const DB_VERSION = 1;
const DRAFT_STORE = 'drafts';
const MEDIA_STORE = 'draft-media';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento local'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha no armazenamento local'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Operação local cancelada'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE, { keyPath: 'draftId' });
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponível'));
  });
}

async function sourceToBlob(source: DraftMediaSource): Promise<Blob> {
  const response = await fetch(source.uri);
  if (!response.ok) throw new Error('Não foi possível preservar uma evidência no rascunho');
  return response.blob();
}

function mediaStorageKey(draftId: string, mediaId: string): string {
  return `${draftId}:${mediaId}`;
}

async function loadStoredDraft(draftId: string): Promise<VerificationDraftV1 | null> {
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, 'readonly');
  const result = await requestResult(
    transaction.objectStore(DRAFT_STORE).get(draftId) as IDBRequest<VerificationDraftV1 | undefined>,
  );
  database.close();
  return result ?? null;
}

async function hydrateDraft(stored: VerificationDraftV1): Promise<VerificationDraftV1> {
  const database = await openDatabase();
  const transaction = database.transaction(MEDIA_STORE, 'readonly');
  const store = transaction.objectStore(MEDIA_STORE);
  const hydrated: { ref: DraftMediaRef; uri: string }[] = [];

  for (const ref of stored.media) {
    const blob = await requestResult(store.get(ref.storageKey) as IDBRequest<Blob | undefined>);
    if (blob) hydrated.push({ ref, uri: URL.createObjectURL(blob) });
  }

  database.close();
  return { ...stored, state: applyHydratedMedia(stored.state, hydrated) };
}

export const draftStore: DraftStore = {
  async save(draft, media) {
    const database = await openDatabase();
    const blobs = await Promise.all(
      media.map(async source => ({ source, blob: await sourceToBlob(source) })),
    );
    const transaction = database.transaction([DRAFT_STORE, MEDIA_STORE], 'readwrite');
    const draftObjectStore = transaction.objectStore(DRAFT_STORE);
    const mediaObjectStore = transaction.objectStore(MEDIA_STORE);
    const previous = await requestResult(
      draftObjectStore.get(draft.draftId) as IDBRequest<VerificationDraftV1 | undefined>,
    );

    const refs = blobs.map(({ source }) => ({
      id: source.id,
      kind: source.kind,
      itemId: source.itemId,
      storageKey: mediaStorageKey(draft.draftId, source.id),
      mimeType: source.mimeType,
    } satisfies DraftMediaRef));
    const keep = new Set(refs.map(ref => ref.storageKey));

    for (const ref of previous?.media ?? []) {
      if (!keep.has(ref.storageKey)) mediaObjectStore.delete(ref.storageKey);
    }
    for (const { source, blob } of blobs) {
      mediaObjectStore.put(blob, mediaStorageKey(draft.draftId, source.id));
    }

    draftObjectStore.put({
      ...draft,
      state: sanitizeDraftState(draft.state),
      media: refs,
    } satisfies VerificationDraftV1);

    await transactionDone(transaction);
    database.close();
  },

  async load(draftId) {
    const stored = await loadStoredDraft(draftId);
    return stored ? hydrateDraft(stored) : null;
  },

  async listForUser(userId) {
    const database = await openDatabase();
    const transaction = database.transaction(DRAFT_STORE, 'readonly');
    const all = await requestResult(
      transaction.objectStore(DRAFT_STORE).getAll() as IDBRequest<VerificationDraftV1[]>,
    );
    database.close();
    const matching = all
      .filter(draft => draft.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return matching;
  },

  async delete(draftId) {
    const stored = await loadStoredDraft(draftId);
    const database = await openDatabase();
    const transaction = database.transaction([DRAFT_STORE, MEDIA_STORE], 'readwrite');
    transaction.objectStore(DRAFT_STORE).delete(draftId);
    const mediaStore = transaction.objectStore(MEDIA_STORE);
    for (const ref of stored?.media ?? []) mediaStore.delete(ref.storageKey);
    await transactionDone(transaction);
    database.close();
  },

  async deleteForUser(userId) {
    const drafts = await this.listForUser(userId);
    await Promise.all(drafts.map(draft => this.delete(draft.draftId)));
  },
};
