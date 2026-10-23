// MUST be first — loads react-native and calls StyleSheet.setFlag('darkMode','class')
// before NativeWind (global.css) initializes and modifies <html>, which would
// otherwise trigger RNWeb's MutationObserver and throw "Cannot manually set color scheme".
import '../lib/setup-rn-web';
import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InstallBanner } from '../components/InstallBanner.web';
import { NovaVersaoAviso } from '../components/NovaVersaoAviso.web';
import { PullToRefresh } from '../components/PullToRefresh.web';
import { carregarClerk } from '../lib/auth/clerk';
import { SessaoProvider, useSessao } from '../lib/auth/sessao';
import { PowerSyncContext } from '@powersync/react';
import { isPullToRefreshEnabled } from '../lib/pull-to-refresh';
import { db } from '../lib/powersync';
import { assinarDownloads } from '../lib/media-api';
import { supabase } from '../lib/supabase';
import { ThemeProvider } from '../lib/theme/ThemeProvider';

// Só em desenvolvimento (ou num build de teste com EXPO_PUBLIC_E2E=1): acesso ao banco local e ao Clerk pelo
// console do navegador, usado pelos testes automatizados. No build normal o bloco some do bundle.
if ((__DEV__ || process.env.EXPO_PUBLIC_E2E === '1') && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__prumoqDev = { db, carregarClerk, supabase, assinarDownloads };
}

export default function RootLayout() {
  return (
    <SessaoProvider>
      <RootNavigator />
    </SessaoProvider>
  );
}

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const isPrintRoute = segments.some((segment) => segment === 'print');
  const pullToRefreshEnabled = isPullToRefreshEnabled(segments as string[]);
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

  useEffect(() => {
    // Avoid "Attempted to navigate before mounting the Root Layout component".
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Leva para o login quem não tem sessão e para o app quem acabou de entrar. Rotas de (auth) são públicas
  // (login e recuperação de senha); uma rota profunda aberta com sessão ativa permanece onde está.
  const { estado } = useSessao();
  useEffect(() => {
    if (!ready) return;
    const currentSegments = segments as string[];
    const onAuthRoute = currentSegments[0] === '(auth)';
    if (estado.fase === 'ativa') {
      if (onAuthRoute || !currentSegments[0]) router.replace('/(app)/(tabs)');
    } else if (estado.fase === 'deslogado' || estado.fase === 'expirada') {
      if (!onAuthRoute) router.replace('/(auth)/login');
    }
  }, [ready, estado.fase, segments, router]);

  // Mesmo provider do nativo: as telas usam SafeAreaView do safe-area-context,
  // que exige um provider acima. No browser os insets vêm de env(safe-area-*),
  // zero em desktop e reais na PWA instalada no iOS.
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PowerSyncContext.Provider value={db}>
          {isPrintRoute ? (
            <Slot />
          ) : (
            <PullToRefresh
              enabled={pullToRefreshEnabled}
              onRefresh={refreshCurrentScreen}
            >
              <InstallBanner />
              <Slot key={screenRefreshKey} />
              <NovaVersaoAviso />
            </PullToRefresh>
          )}
        </PowerSyncContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
