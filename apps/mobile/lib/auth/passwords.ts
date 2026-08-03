import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { z } from 'zod';

export const RECOVERY_SESSION_STORAGE_KEY = 'prumoq:password-recovery-user';
const PASSWORD_CHANGED_STORAGE_KEY = 'prumoq:password-changed';

type PasswordSetupUser = {
  invited_at?: string;
  user_metadata?: Record<string, unknown>;
};

const emailSchema = z.string().trim().email('Informe um e-mail válido');
const passwordSchema = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres');

export function validateRecoveryEmail(email: string): string | null {
  const result = emailSchema.safeParse(email);
  return result.success ? null : result.error.issues[0]?.message ?? 'E-mail inválido';
}

export function validateNewPassword(
  password: string,
  confirmation: string,
  currentPassword?: string,
): string | null {
  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    return result.error.issues[0]?.message ?? 'Senha inválida';
  }
  if (password !== confirmation) return 'As senhas não coincidem';
  if (currentPassword !== undefined && password === currentPassword) {
    return 'A nova senha deve ser diferente da senha atual';
  }
  return null;
}

export function getPublicPwaOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  const configuredOrigin = process.env.EXPO_PUBLIC_PWA_URL?.trim().replace(/\/+$/, '');
  if (!configuredOrigin) {
    throw new Error('A URL pública da PWA não está configurada neste aplicativo.');
  }
  return configuredOrigin;
}

export function getPasswordRecoveryRedirectUrl(): string {
  return `${getPublicPwaOrigin()}/redefinir-senha`;
}

export function isInvitationPasswordSetup(user: PasswordSetupUser): boolean {
  return Boolean(user.invited_at) && !user.user_metadata?.onboarding_completed_at;
}

export function markPasswordRecoverySession(userId: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(RECOVERY_SESSION_STORAGE_KEY, userId);
  }
}

export function clearPasswordRecoverySession(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY);
  }
}

export function isMarkedPasswordRecoverySession(userId: string): boolean {
  return typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem(RECOVERY_SESSION_STORAGE_KEY) === userId;
}

export function getPasswordAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('same password') || normalized.includes('different from the old')) {
    return 'A nova senha deve ser diferente da senha atual.';
  }
  if (normalized.includes('current password') || normalized.includes('invalid login credentials')) {
    return 'A senha atual está incorreta.';
  }
  if (normalized.includes('weak password') || normalized.includes('password should')) {
    return 'A nova senha não atende à política de segurança.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'É necessário estar online para alterar a senha.';
  }
  return 'Não foi possível concluir a alteração de senha. Tente novamente.';
}

export function getPasswordRecoveryRequestErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Muitas solicitações. Aguarde alguns minutos e tente novamente.';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'É necessário estar online para solicitar a recuperação.';
  }
  return 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.';
}

export async function markPasswordChanged(): Promise<void> {
  await AsyncStorage.setItem(PASSWORD_CHANGED_STORAGE_KEY, '1');
}

export async function consumePasswordChanged(): Promise<boolean> {
  const changed = await AsyncStorage.getItem(PASSWORD_CHANGED_STORAGE_KEY);
  if (changed) await AsyncStorage.removeItem(PASSWORD_CHANGED_STORAGE_KEY);
  return changed === '1';
}
