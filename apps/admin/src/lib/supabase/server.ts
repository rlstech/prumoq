// Compatibilidade com o código vindo do Next: as antigas server actions e páginas pediam um cliente "de servidor".
// No painel estático tudo roda no navegador com o token do próprio usuário; a RLS do banco é quem autoriza.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { createClient as createBrowserClient } from './client';

export async function createClient(): Promise<SupabaseClient<Database>> {
  return createBrowserClient();
}
