// MUST be first — loads react-native and calls StyleSheet.setFlag('darkMode','class')
// before NativeWind (global.css) initializes and modifies <html>, which would
// otherwise trigger RNWeb's MutationObserver and throw "Cannot manually set color scheme".
import '../lib/setup-rn-web';
import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InstallBanner } from '../components/InstallBanner.web';
import { PullToRefresh } from '../components/PullToRefresh.web';
import {
  clearPasswordRecoverySession,
  isMarkedPasswordRecoverySession,
  markPasswordRecoverySession,
} from '../lib/auth/passwords';
import { isPullToRefreshEnabled } from '../lib/pull-to-refresh';
import { supabase } from '../lib/supabase';
import { ThemeProvider } from '../lib/theme/ThemeProvider';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const isPrintRoute = segments.some((segment) => segment === 'print');
  const pullToRefreshEnabled = isPullToRefreshEnabled(segments as string[]);
  const segmentsRef = useRef(segments);
  const [ready, setReady] = useState(false);
  const [screenRefreshKey, setScreenRefreshKey] = useState(0);

  const refreshCurrentScreen = useCallback(async () => {
    setScreenRefreshKey(current => current + 1);
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = 'pt-BR';
  }, []);

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
      const currentSegments = segmentsRef.current as string[];
      const onAuthRoute = currentSegments[0] === '(auth)';
      const authScreen = currentSegments[1];
      const onPasswordReset = onAuthRoute && authScreen === 'redefinir-senha';

      if (event === 'PASSWORD_RECOVERY' && session) {
        markPasswordRecoverySession(session.user.id);
        if (!onPasswordReset) router.replace('/(auth)/redefinir-senha');
        return;
      }

      // INITIAL_SESSION: restore existing session on page load/refresh
      if (event === 'INITIAL_SESSION') {
        if (session && isMarkedPasswordRecoverySession(session.user.id)) {
          if (!onPasswordReset) router.replace('/(auth)/redefinir-senha');
          return;
        }

        // The recovery page owns validation of the temporary recovery session.
        // Navigating away here would consume a valid e-mail link before the
        // user has a chance to choose a new password.
        if (onPasswordReset) return;

        if (session) {
          // Só redireciona para o dashboard se estiver numa rota de auth ou na raiz.
          // Se o usuário atualizou a página em uma rota profunda (ex: /obras/.../fvs/...),
          // permanece nela — não volta para o dashboard.
          const onAuthOrRoot = onAuthRoute || !currentSegments[0];
          if (onAuthOrRoot) router.replace('/(app)/(tabs)');
        } else {
          // Login and password-recovery request are intentionally public.
          if (!onAuthRoute) router.replace('/(auth)/login');
        }
        return;
      }
      // SIGNED_IN navigation is handled by the login screen after profile check
      if (event === 'SIGNED_OUT') {
        clearPasswordRecoverySession();
        // Don't redirect if already on the login screen — avoids remounting the
        // login component and silently clearing its error state (e.g. after a
        // profile-restriction signOut from inside the login handler itself).
        const onLogin = currentSegments[0] === '(auth)';
        if (!onLogin) router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [ready]); // segments deliberately excluded — use segmentsRef instead

  // Mesmo provider do nativo: as telas usam SafeAreaView do safe-area-context,
  // que exige um provider acima. No browser os insets vêm de env(safe-area-*),
  // zero em desktop e reais na PWA instalada no iOS.
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {isPrintRoute ? (
          <Slot />
        ) : (
          <PullToRefresh
            enabled={pullToRefreshEnabled}
            onRefresh={refreshCurrentScreen}
          >
            <InstallBanner />
            <Slot key={screenRefreshKey} />
          </PullToRefresh>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
