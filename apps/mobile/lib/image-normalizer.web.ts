export const MAX_PHOTO_DIMENSION = 2048;
export const PHOTO_COMPRESSION = 0.78;
export const THUMBNAIL_DIMENSION = 480;

/** Converts browser-selected evidence into a bounded JPEG before it is queued. */
export async function normalizeEvidencePhoto(uri: string): Promise<string> {
  const source = await fetch(uri);
  if (!source.ok) throw new Error('Não foi possível ler a foto selecionada.');
  const blob = await source.blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a foto selecionada.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const normalized = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Não foi possível comprimir a foto selecionada.')),
      'image/jpeg', PHOTO_COMPRESSION);
  });
  return URL.createObjectURL(normalized);
}

export async function createEvidenceThumbnail(uri: string): Promise<Blob> {
  const source = await fetch(uri);
  if (!source.ok) throw new Error('Não foi possível ler a foto para miniatura.');
  const bitmap = await createImageBitmap(await source.blob());
  const scale = Math.min(1, THUMBNAIL_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a miniatura.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(new Error('Não foi possível criar a miniatura.')),
    'image/jpeg',
    PHOTO_COMPRESSION,
  ));
}
