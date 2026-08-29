import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { normalizeEvidencePhoto } from '../lib/image-normalizer';
import { uuid } from '../lib/uuid';

const PENDING_MEDIA_DIRECTORY = `${FileSystem.documentDirectory}prumoq-pending-media/`;

/** Normalizes the picked asset and stores it durably until PowerSync uploads it. */
async function storeAsset(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const src = await normalizeEvidencePhoto(asset.uri, asset.width, asset.height);
  await FileSystem.makeDirectoryAsync(PENDING_MEDIA_DIRECTORY, { intermediates: true });
  const dest = `${PENDING_MEDIA_DIRECTORY}nc_${uuid()}.jpg`;
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
