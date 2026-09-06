import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { normalizeEvidencePhoto } from '../lib/image-normalizer';
import { storePendingMedia } from '../lib/pending-media';

async function saveForOfflineSync(uri: string, width?: number, height?: number): Promise<string> {
  const normalizedUri = await normalizeEvidencePhoto(uri, width, height);
  return storePendingMedia(normalizedUri);
}

async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

async function requestMediaPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

interface UsePhotoCaptureOptions {
  photos?: string[];
  onChange?: (photos: string[]) => void;
}

interface UsePhotoCaptureReturn {
  photos: string[];           // local file paths
  addFromCamera: () => Promise<void>;
  addFromGallery: () => Promise<void>;
  removePhoto: (index: number) => void;
  setPhotos: (photos: string[]) => void;
}

export function usePhotoCapture(
  initialPhotos: string[] = [],
  options: UsePhotoCaptureOptions = {},
): UsePhotoCaptureReturn {
  const [internalPhotos, setInternalPhotos] = useState<string[]>(initialPhotos);
  const photos = options.photos ?? internalPhotos;
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const commitPhotos = useCallback((
    update: string[] | ((current: string[]) => string[]),
  ) => {
    const next = typeof update === 'function' ? update(photosRef.current) : update;
    photosRef.current = next;
    if (options.onChange) options.onChange(next);
    else setInternalPhotos(next);
  }, [options.onChange]);

  const addFromCamera = useCallback(async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const localPath = await saveForOfflineSync(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
      commitPhotos(prev => [...prev, localPath]);
    }
  }, [commitPhotos]);

  const addFromGallery = useCallback(async () => {
    const granted = await requestMediaPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      const localPath = await saveForOfflineSync(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
      commitPhotos(prev => [...prev, localPath]);
    }
  }, [commitPhotos]);

  const removePhoto = useCallback((index: number) => {
    commitPhotos(prev => prev.filter((_, i) => i !== index));
  }, [commitPhotos]);

  return {
    photos,
    addFromCamera,
    addFromGallery,
    removePhoto,
    setPhotos: photos => commitPhotos(photos),
  };
}
