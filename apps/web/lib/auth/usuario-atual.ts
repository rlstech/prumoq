import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';

// Identidade do usuário logado COMO O BANCO A ENXERGA (a mesma que a RLS usa). Evita que as telas
// precisem conhecer o id do Clerk: `id` é o UUID interno de `usuarios`, o que as FKs esperam.
export async function getUsuarioAtual(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; clienteId: string | null } | null> {
  const [{ data: id }, { data: clienteId }] = await Promise.all([
    supabase.rpc('current_usuario_id'),
    supabase.rpc('get_cliente_id'),
  ]);
  if (!id) return null;
  return { id: id as string, clienteId: (clienteId as string | null) ?? null };
}
