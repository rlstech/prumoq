import type { Database } from '@prumoq/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function signPrivateMedia(
  client: SupabaseClient<Database>,
  input: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const keys = Array.from(new Set(input.filter((value): value is string =>
    Boolean(value) && !value!.startsWith('http') && !value!.startsWith('data:') &&
    !value!.startsWith('pending:') && !value!.startsWith('blob:'),
  )));
  if (!keys.length) return new Map();

  const result = new Map<string, string>();
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const { data, error } = await client.functions.invoke('r2-presign', {
      body: { operation: 'download', keys: batch },
    });
    if (error) throw new Error(`Falha ao autorizar anexos: ${error.message}`);
    const urls = (data as { urls?: Record<string, string> } | null)?.urls ?? {};
    for (const [key, url] of Object.entries(urls)) result.set(key, url);
  }
  return result;
}
