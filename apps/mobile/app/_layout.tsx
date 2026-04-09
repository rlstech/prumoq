import '../global.css';
import { PowerSyncContext } from '@powersync/react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { db } from '../lib/powersync';
import { supabase } from '../lib/supabase';
import { SupabaseConnector } from '../lib/supabase-connector';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function init() {
      await db.init();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await db.connect(new SupabaseConnector());
      }
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (!ready) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await db.connect(new SupabaseConnector());
          router.replace('/(app)/(tabs)');
        }
        if (event === 'SIGNED_OUT') {
          await db.disconnect();
          await db.clearLocal();
          router.replace('/(auth)/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [ready]);

  if (!ready) return null;

  return (
    <PowerSyncContext.Provider value={db}>
      <Slot />
    </PowerSyncContext.Provider>
  );
}
