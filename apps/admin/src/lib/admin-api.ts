import { NEON_TOKEN_TEMPLATE } from '@/lib/neon/data-client';
import { getClerkToken } from '@/lib/auth/clerk-browser';

export type AdminApiResult = { success: true } | { success: false; error: string };

// Rotas do Worker do painel (apps/admin/worker) para o que exige segredo: contas no Clerk. O token `neon`
// identifica quem chama (o Worker o repassa à Data API, que aplica a RLS).
export async function callAdminApi(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<AdminApiResult> {
  const token = await getClerkToken(NEON_TOKEN_TEMPLATE);
  if (!token) return { success: false, error: 'Sessão expirada. Entre novamente.' };
  try {
    const response = await fetch(`/admin/api/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null) as AdminApiResult | null;
    return result ?? { success: false, error: `Falha na operação (HTTP ${response.status}).` };
  } catch {
    return { success: false, error: 'Sem conexão com o servidor. Tente novamente.' };
  }
}
