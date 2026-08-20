import * as ImageManipulator from 'expo-image-manipulator';

export const MAX_PHOTO_DIMENSION = 2048;
export const PHOTO_COMPRESSION = 0.78;
export const THUMBNAIL_DIMENSION = 480;

/**
 * Creates the evidence file that is kept offline and later sent to R2.
 * Evidence photos are always JPEGs; signatures intentionally do not use this
 * helper and remain PNGs.
 */
export async function normalizeEvidencePhoto(
  uri: string,
  width?: number,
  height?: number,
): Promise<string> {
  const largestDimension = Math.max(width ?? 0, height ?? 0);
  const resize = largestDimension > MAX_PHOTO_DIMENSION
    ? width && width >= (height ?? 0)
      ? { width: MAX_PHOTO_DIMENSION }
      : { height: MAX_PHOTO_DIMENSION }
    : undefined;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    resize ? [{ resize }] : [],
    {
      compress: PHOTO_COMPRESSION,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return result.uri;
}

export async function createEvidenceThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: THUMBNAIL_DIMENSION } }],
    { compress: PHOTO_COMPRESSION, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}
