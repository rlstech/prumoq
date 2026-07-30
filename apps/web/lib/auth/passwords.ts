import { z } from 'zod';

export const minimumPasswordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe sua senha atual'),
    newPassword: minimumPasswordSchema,
    confirmation: z.string().min(1, 'Confirme a nova senha'),
  })
  .superRefine((data, context) => {
    if (data.newPassword !== data.confirmation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmation'],
        message: 'As senhas não coincidem',
      });
    }
    if (data.newPassword === data.currentPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newPassword'],
        message: 'A nova senha deve ser diferente da senha atual',
      });
    }
  });

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

export function getConfiguredPwaOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_PWA_URL?.trim().replace(/\/+$/, '');
  if (!origin && process.env.NODE_ENV === 'development') {
    return 'http://localhost:8081';
  }
  if (!origin) throw new Error('A URL pública da PWA não está configurada.');
  return origin;
}
