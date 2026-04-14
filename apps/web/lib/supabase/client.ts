import { createBrowserClient, SupabaseClient } from '@supabase/ssr';
import type { Database } from '@prumoq/shared';

let _supabaseBrowserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (_supabaseBrowserClient) {
    return _supabaseBrowserClient;
  }
  
  _supabaseBrowserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  return _supabaseBrowserClient;
}
