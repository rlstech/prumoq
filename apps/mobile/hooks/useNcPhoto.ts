import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { normalizeEvidencePhoto } from '../lib/image-normalizer';
import { uuid } from '../lib/uuid';

/** Normalizes the picked asset and copies it into the cache under a stable
 * name, so the draft can reference a path that survives the picker closing. */
async function storeAsset(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const src = await normalizeEvidencePhoto(asset.uri, asset.width, asset.height);
  const dest = `${FileSystem.cacheDirectory}nc_${uuid()}.jpg`;
  await FileSystem.copyAsync({ from: src, to: dest });
  return dest;
}

/** Opens the camera. The primary path: the inspector is standing at the defect. */
export async function captureNcPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return storeAsset(result.assets[0]);
}

/** Opens the gallery. The escape hatch for when the photo was already taken,
 * the light is wrong, or the hands are full — before this existed, the camera
 * was the only way in and cancelling left the NC blocked on a missing photo. */
export async function pickNcPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return storeAsset(result.assets[0]);
}
