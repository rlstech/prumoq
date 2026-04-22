// MUST be first — loads react-native and calls StyleSheet.setFlag('darkMode','class')
// before NativeWind (global.css) initializes and modifies <html>, which would
// otherwise trigger RNWeb's MutationObserver and throw "Cannot manually set color scheme".
import '../lib/setup-rn-web';
import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { InstallBanner } from '../components/InstallBanner.web';
import { PullToRefresh } from '../components/PullToRefresh.web';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  const [ready, setReady] = useState(false);

  // Keep ref current on every render so the auth listener always sees the
  // latest segments WITHOUT being a dependency (avoids re-subscribing on navigation).
  segmentsRef.current = segments;

  useEffect(() => {
    // Avoid "Attempted to navigate before mounting the Root Layout component"
    // by ensuring initial mount completes before listening to auth state.
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION: restore existing session on page load/refresh
      if (event === 'INITIAL_SESSION') {
        if (session) {
          // Só redireciona para o dashboard se estiver numa rota de auth ou na raiz.
          // Se o usuário atualizou a página em uma rota profunda (ex: /obras/.../fvs/...),
          // permanece nela — não volta para o dashboard.
          const onAuthOrRoot = segmentsRef.current[0] === '(auth)' || segmentsRef.current.length === 0;
          if (onAuthOrRoot) router.replace('/(app)/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
        return;
      }
      // SIGNED_IN navigation is handled by the login screen after profile check
      if (event === 'SIGNED_OUT') {
        // Don't redirect if already on the login screen — avoids remounting the
        // login component and silently clearing its error state (e.g. after a
        // profile-restriction signOut from inside the login handler itself).
        const onLogin = segmentsRef.current[0] === '(auth)';
        if (!onLogin) router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [ready]); // segments deliberately excluded — use segmentsRef instead

  return (
    <PullToRefresh>
      <InstallBanner />
      <Slot />
    </PullToRefresh>
  );
}
