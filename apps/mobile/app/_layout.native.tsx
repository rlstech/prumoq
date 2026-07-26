import '../global.css';
import { PowerSyncContext } from '@powersync/react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { db } from '../lib/powersync';
import { supabase } from '../lib/supabase';
import { SupabaseConnector } from '../lib/supabase-connector';
import { ThemeProvider } from '../lib/theme/ThemeProvider';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function init() {
      try {
        const [, { data: { session } }] = await Promise.all([
          db.init(),
          supabase.auth.getSession(),
        ]);
        if (session) {
          await db.connect(new SupabaseConnector());
        }
      } catch (e) {
        console.error('[RootLayout] init error:', e);
      } finally {
        setReady(true);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!ready) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Connect PowerSync on sign-in; navigation is handled by the
          // login screen after the profile check completes.
          await db.connect(new SupabaseConnector());
        }
        if (event === 'SIGNED_OUT') {
          await db.disconnectAndClear();
          router.replace('/(auth)/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <PowerSyncContext.Provider value={db}>
        <Slot />
      </PowerSyncContext.Provider>
    </ThemeProvider>
  );
}
