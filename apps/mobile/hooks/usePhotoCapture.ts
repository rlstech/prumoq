import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

async function saveToCache(uri: string): Promise<string> {
  const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

async function requestMediaPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

interface UsePhotoCaptureReturn {
  photos: string[];           // local file paths
  addFromCamera: () => Promise<void>;
  addFromGallery: () => Promise<void>;
  removePhoto: (index: number) => void;
  setPhotos: (photos: string[]) => void;
}

export function usePhotoCapture(initialPhotos: string[] = []): UsePhotoCaptureReturn {
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  const addFromCamera = useCallback(async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const localPath = await saveToCache(result.assets[0].uri);
      setPhotos(prev => [...prev, localPath]);
    }
  }, []);

  const addFromGallery = useCallback(async () => {
    const granted = await requestMediaPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      const localPath = await saveToCache(result.assets[0].uri);
      setPhotos(prev => [...prev, localPath]);
    }
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { photos, addFromCamera, addFromGallery, removePhoto, setPhotos };
}
