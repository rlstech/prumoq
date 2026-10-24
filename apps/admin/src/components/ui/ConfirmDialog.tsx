import Modal from './Modal';
import { AlertTriangle } from '@/components/icons';

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
  const tile =
    variant === 'danger' ? 'bg-nok-bg text-nok' : variant === 'warning' ? 'bg-warn-bg text-warn' : 'bg-pg-bg text-pg';
  const confirm =
    variant === 'danger'
      ? 'bg-nok text-white hover:bg-nok/90'
      : variant === 'warning'
        ? 'bg-warn text-white hover:bg-warn/90'
        : 'bg-accent text-txt hover:bg-accent-pressed';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-start gap-5">
        <div className={`flex h-14 w-14 items-center justify-center rounded-lg ${tile}`}>
          <AlertTriangle size={28} />
        </div>
        <p className="text-[15px] leading-relaxed text-txt-2">{message}</p>

        <div className="flex w-full gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-12 flex-1 rounded-full bg-bg-0 px-5 text-[15px] font-semibold text-txt transition-colors hover:bg-bg-2"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`h-12 flex-1 rounded-full px-5 text-[15px] font-bold transition-colors disabled:opacity-60 ${confirm}`}
          >
            {isLoading ? 'Aguarde...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
