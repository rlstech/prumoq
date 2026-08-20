// TypeScript's Node resolver does not select platform suffixes. Metro and the
// Expo web resolver select image-normalizer.native/web at runtime; this file
// supplies the common compile-time contract.
export const MAX_PHOTO_DIMENSION = 2048;
export const PHOTO_COMPRESSION = 0.78;
export const THUMBNAIL_DIMENSION = 480;

export async function normalizeEvidencePhoto(uri: string, _width?: number, _height?: number): Promise<string> {
  return uri;
}

export async function createEvidenceThumbnail(_uri: string): Promise<Blob> {
  throw new Error('Platform image normalizer was not resolved.');
}
