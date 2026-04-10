import { createClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Web client: uses localStorage by default (no AsyncStorage needed)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
