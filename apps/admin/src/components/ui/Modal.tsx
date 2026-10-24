
import { useEffect } from 'react';
import { X } from '@/components/icons';

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
    <div className={`fixed inset-0 z-50 flex ${isCentered ? 'items-center justify-center p-4' : 'items-end justify-end sm:items-stretch sm:p-3'}`}>
      <div 
        className="absolute inset-0 bg-[rgba(28,31,34,.62)] transition-opacity"
        onClick={onClose}
      />
      
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full flex-col overflow-hidden bg-bg-1 shadow-float ${
          isCentered
            ? `max-h-[95vh] rounded-2xl ${sizeClasses[size]}`
            : `max-h-[92vh] rounded-t-2xl sm:h-full sm:max-h-none sm:rounded-2xl ${sizeClasses[size]}`
        }`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-6 sm:px-7">
          <h2 className="pt-1 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-txt">{title}</h2>
          <button 
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-0 text-txt transition-colors hover:bg-bg-2"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1 sm:px-7">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-brd-0 px-5 py-4 sm:px-7">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
