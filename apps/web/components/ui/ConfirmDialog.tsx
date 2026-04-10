'use client';

import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center p-2">
        <div className={`p-4 rounded-full mb-4 ${
          variant === 'danger' ? 'bg-nok-bg text-nok' :
          variant === 'warning' ? 'bg-warn-bg text-warn' :
          'bg-pg-bg text-pg'
        }`}>
          <AlertTriangle size={32} />
        </div>
        <p className="text-base text-txt-2 mb-6">{message}</p>
        
        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 bg-bg-2 hover:bg-brd-0 text-txt-2 rounded-lg font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 px-4 text-white rounded-lg font-medium transition-colors disabled:opacity-60 ${
              variant === 'danger' ? 'bg-nok hover:bg-nok/90' :
              variant === 'warning' ? 'bg-warn hover:bg-warn/90' :
              'bg-pg hover:bg-pg/90'
            }`}
          >
            {isLoading ? 'Aguarde...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
