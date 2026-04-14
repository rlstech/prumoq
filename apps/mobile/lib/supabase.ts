import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@prumoq/shared';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// On web, use the browser's native localStorage so the session is accessible
// synchronously. AsyncStorage wraps localStorage in Promises on web, which can
// cause timing issues with getSession() right after signInWithPassword().
const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnon, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
