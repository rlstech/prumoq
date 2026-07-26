'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-[440px]',
    md: 'max-w-[560px]',
    lg: 'max-w-[720px]',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] h-[95vh]'
  };
  const isCentered = size === 'xl' || size === 'full';

  return (
    <div className={`fixed inset-0 z-50 flex ${isCentered ? 'items-center justify-center p-4' : 'items-end justify-end sm:items-stretch'}`}>
      <div 
        className="absolute inset-0 bg-[rgba(20,37,34,.58)] backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full flex-col overflow-hidden bg-bg-1 shadow-float ${
          isCentered
            ? `max-h-[95vh] rounded-xl ${sizeClasses[size]}`
            : `max-h-[92vh] rounded-t-xl sm:max-h-none sm:h-full sm:rounded-none sm:rounded-l-xl ${sizeClasses[size]}`
        }`}
      >
        <div className="flex min-h-[72px] items-center justify-between border-b border-brd-0 px-5 py-4 sm:px-6">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--prumo-brand)]">PrumoQ</div>
            <h2 className="text-lg font-semibold text-txt">{title}</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-txt-3 transition-colors hover:bg-bg-2 hover:text-txt"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-brd-0 bg-bg-0 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
