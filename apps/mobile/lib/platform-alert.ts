import { Alert, Platform } from 'react-native';

export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}): void {
  const {
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    destructive,
    onConfirm,
    onCancel,
  } = opts;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    else onCancel?.();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel', onPress: onCancel },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function alertInfo(title: string, message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}