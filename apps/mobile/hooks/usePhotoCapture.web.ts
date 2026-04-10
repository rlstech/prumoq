import { useCallback, useState } from 'react';

export interface UsePhotoCaptureReturn {
  photos: string[];
  addFromCamera: () => Promise<void>;
  addFromGallery: () => Promise<void>;
  removePhoto: (index: number) => void;
  setPhotos: (photos: string[]) => void;
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

export function usePhotoCapture(initialPhotos: string[] = []): UsePhotoCaptureReturn {
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  const addFromCamera = useCallback(async () => {
    const url = await pickFile('environment');
    if (url) setPhotos((prev) => [...prev, url]);
  }, []);

  const addFromGallery = useCallback(async () => {
    const url = await pickFile(undefined);
    if (url) setPhotos((prev) => [...prev, url]);
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      // Revoke blob URL to free memory
      const url = prev[index];
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return { photos, addFromCamera, addFromGallery, removePhoto, setPhotos };
}
