import { z } from 'zod';

const emailSchema = z.string().trim().email('Informe um e-mail válido');
// Mesmo mínimo do painel web e da configuração do Clerk.
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
