import { useCallback, useRef, useState } from 'react';

export interface UsePhotoCaptureReturn {
  photos: string[];
  addFromCamera: () => Promise<void>;
  addFromGallery: () => Promise<void>;
  removePhoto: (index: number) => void;
  setPhotos: (photos: string[]) => void;
}

interface UsePhotoCaptureOptions {
  photos?: string[];
  onChange?: (photos: string[]) => void;
}

function pickFile(capture?: 'environment' | 'user'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', capture);
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve(URL.createObjectURL(file));
      } else {
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
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
    const url = await pickFile('environment');
    if (url) commitPhotos(prev => [...prev, url]);
  }, [commitPhotos]);

  const addFromGallery = useCallback(async () => {
    const url = await pickFile(undefined);
    if (url) commitPhotos(prev => [...prev, url]);
  }, [commitPhotos]);

  const removePhoto = useCallback((index: number) => {
    commitPhotos(prev => {
      // Revoke blob URL to free memory
      const url = prev[index];
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }, [commitPhotos]);

  return {
    photos,
    addFromCamera,
    addFromGallery,
    removePhoto,
    setPhotos: photos => commitPhotos(photos),
  };
}
