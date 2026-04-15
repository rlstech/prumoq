import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';

let _supabaseBrowserClient: any;

export function createClient() {
  if (_supabaseBrowserClient) {
    return _supabaseBrowserClient;
  }
  
  _supabaseBrowserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  return _supabaseBrowserClient as any;
}
