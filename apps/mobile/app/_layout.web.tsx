import '../global.css';
import { Slot, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { InstallBanner } from '../components/InstallBanner.web';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') router.replace('/(app)/(tabs)');
      if (event === 'SIGNED_OUT') router.replace('/(auth)/login');
    });

    return () => subscription.unsubscribe();
  }, [ready]);

  if (!ready) return null;

  // No PowerSyncContext.Provider needed on web — useQuery goes directly to Supabase
  return (
    <View style={{ flex: 1 }}>
      <InstallBanner />
      <Slot />
    </View>
  );
}
