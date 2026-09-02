import { PowerSyncContext } from '@powersync/react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { db } from '../lib/powersync';
import { supabase } from '../lib/supabase';
import { SupabaseConnector } from '../lib/supabase-connector';
import { validateMobileAccess } from '../lib/auth/mobile-access';
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
          const accessError = await validateMobileAccess(session.user.id);
          if (accessError) {
            await supabase.auth.signOut();
            await db.disconnectAndClear();
          } else {
            await db.connect(new SupabaseConnector());
          }
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
          const accessError = await validateMobileAccess(session.user.id);
          if (accessError) {
            await supabase.auth.signOut();
          } else {
            await db.connect(new SupabaseConnector());
          }
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

  // SafeAreaProvider por fora de tudo: os navigators do React Navigation montam
  // um provider próprio, mas as telas de (auth) e qualquer coisa renderizada
  // fora de um navigator dependem deste para ter insets reais no Android.
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PowerSyncContext.Provider value={db}>
          <Slot />
        </PowerSyncContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
