'use client';

import { useState } from 'react';
import Image from 'next/image';
import Modal from './Modal';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Photo {
  r2_key: string;
  r2_thumb_key?: string;
  caption?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
}

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

  const getUrl = (key: string) => {
    if (key.startsWith('http')) return key;
    return `${publicUrl}/${key}`;
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, idx) => (
          <div 
            key={photo.r2_key}
            className="aspect-square relative rounded-md overflow-hidden cursor-pointer border border-brd-0"
            onClick={() => setSelectedIndex(idx)}
          >
            {/* Using img tag to avoid Next.js Image hostname config issues temporarily */}
            <img 
              src={getUrl(photo.r2_thumb_key || photo.r2_key)} 
              alt={photo.caption || 'Foto'} 
              className="object-cover w-full h-full hover:scale-105 transition-transform"
            />
          </div>
        ))}
      </div>

      <Modal 
        isOpen={selectedIndex !== null} 
        onClose={() => setSelectedIndex(null)}
        title={selectedIndex !== null ? `Foto ${selectedIndex + 1} de ${photos.length}` : 'Foto'}
        size="lg"
      >
        {selectedIndex !== null && (
          <div className="relative w-full aspect-[4/3] bg-bg-0 rounded-lg overflow-hidden flex items-center justify-center group">
            <img 
              src={getUrl(photos[selectedIndex].r2_key)} 
              alt={photos[selectedIndex].caption || 'Visualização completa'} 
              className="max-w-full max-h-full object-contain"
            />
            
            {selectedIndex > 0 && (
              <button 
                onClick={handlePrev}
                className="absolute left-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            
            {selectedIndex < photos.length - 1 && (
              <button 
                onClick={handleNext}
                className="absolute right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight size={24} />
              </button>
            )}

            {photos[selectedIndex].caption && (
              <div className="absolute bottom-0 inset-x-0 bg-black/60 p-3 text-white text-sm text-center">
                {photos[selectedIndex].caption}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
