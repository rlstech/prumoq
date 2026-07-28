import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {
  applyHydratedMedia,
  DraftMediaRef,
  DraftMediaSource,
  DraftStore,
  sanitizeDraftState,
  VerificationDraftV1,
} from './draft.types';

const INDEX_KEY = '@prumoq:drafts:index:v1';
const DRAFT_PREFIX = '@prumoq:draft:v1:';
const ROOT_DIRECTORY = `${FileSystem.documentDirectory}prumoq-drafts/`;

async function getIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

async function setIndex(ids: string[]) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function extensionFor(source: DraftMediaSource): string {
  if (source.mimeType === 'image/png' || source.kind === 'signature') return 'png';
  return 'jpg';
}

async function persistMedia(
  draftId: string,
  sources: DraftMediaSource[],
): Promise<DraftMediaRef[]> {
  const directory = `${ROOT_DIRECTORY}${encodeURIComponent(draftId)}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const refs: DraftMediaRef[] = [];
  const keep = new Set<string>();

  for (const source of sources) {
    const filename = `${source.id}.${extensionFor(source)}`;
    const target = `${directory}${filename}`;
    keep.add(filename);
    if (source.uri !== target) {
      const targetInfo = await FileSystem.getInfoAsync(target);
      if (targetInfo.exists) await FileSystem.deleteAsync(target, { idempotent: true });
      await FileSystem.copyAsync({ from: source.uri, to: target });
    }
    refs.push({
      id: source.id,
      kind: source.kind,
      itemId: source.itemId,
      storageKey: target,
      mimeType: source.mimeType,
    });
  }

  const existing = await FileSystem.readDirectoryAsync(directory);
  await Promise.all(
    existing
      .filter(filename => !keep.has(filename))
      .map(filename => FileSystem.deleteAsync(`${directory}${filename}`, { idempotent: true })),
  );

  return refs;
}

async function removeMediaDirectory(draftId: string) {
  const directory = `${ROOT_DIRECTORY}${encodeURIComponent(draftId)}/`;
  await FileSystem.deleteAsync(directory, { idempotent: true });
}

export const draftStore: DraftStore = {
  async save(draft, media) {
    const refs = await persistMedia(draft.draftId, media);
    const persisted: VerificationDraftV1 = {
      ...draft,
      state: sanitizeDraftState(draft.state),
      media: refs,
    };
    await AsyncStorage.setItem(`${DRAFT_PREFIX}${draft.draftId}`, JSON.stringify(persisted));
    const index = await getIndex();
    await setIndex([...index, draft.draftId]);
  },

  async load(draftId) {
    const raw = await AsyncStorage.getItem(`${DRAFT_PREFIX}${draftId}`);
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw) as VerificationDraftV1;
      const hydrated = stored.media.map(ref => ({ ref, uri: ref.storageKey }));
      return { ...stored, state: applyHydratedMedia(stored.state, hydrated) };
    } catch {
      return null;
    }
  },

  async listForUser(userId) {
    const ids = await getIndex();
    const drafts = await Promise.all(ids.map(id => this.load(id)));
    return drafts
      .filter((draft): draft is VerificationDraftV1 => !!draft && draft.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async delete(draftId) {
    await Promise.all([
      AsyncStorage.removeItem(`${DRAFT_PREFIX}${draftId}`),
      removeMediaDirectory(draftId),
    ]);
    const index = await getIndex();
    await setIndex(index.filter(id => id !== draftId));
  },

  async deleteForUser(userId) {
    const drafts = await this.listForUser(userId);
    await Promise.all(drafts.map(draft => this.delete(draft.draftId)));
  },
};

