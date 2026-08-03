import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';

let supabaseBrowserClient: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  if (supabaseBrowserClient) {
    return supabaseBrowserClient;
  }
  
  const client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  supabaseBrowserClient = client as unknown as SupabaseClient<Database>;
  return supabaseBrowserClient;
}
