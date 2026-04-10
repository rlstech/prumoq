import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function captureNcPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;

  const src = result.assets[0].uri;
  const dest = `${FileSystem.cacheDirectory}nc_${uuid()}.jpg`;
  await FileSystem.copyAsync({ from: src, to: dest });
  return dest;
}
