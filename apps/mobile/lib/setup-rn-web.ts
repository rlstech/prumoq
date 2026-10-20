/**
 * Web-only bootstrap — MUST be imported as the first import in _layout.web.tsx,
 * before global.css / NativeWind loads.
 *
 * React Native Web registers a MutationObserver on <html> that calls
 * Appearance.set() whenever a dark-mode CSS class is added/removed.
 * Appearance.set() throws when darkMode type is 'media' (the default).
 *
 * Fix 1: StyleSheet.setFlag('darkMode', 'class') changes the type to 'class'
 *         so Appearance.set() no longer throws.
 * Fix 2: Patch Appearance.set to swallow the error as a safety net in case
 *         the flag call runs too late or the API shape differs across versions.
 */
import { Appearance, StyleSheet } from 'react-native';

// Inject PWA manifest link and service worker — works in both dev mode and production.
// (+html.tsx só vale com `web.output: static`; este app usa `single`, então é aqui que valem.)
if (typeof document !== 'undefined') {
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);
  }
  // Service worker (public/sw.js): guarda o app no aparelho para abrir sem internet. Este módulo é carregado
  // pelo Expo Router depois do evento `load` da página, então esperar por ele não registrava nunca.
  if ('serviceWorker' in navigator) {
    const registrar = () => navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] registro falhou:', err);
    });
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
  }
}

// Fix 1 — set dark mode type to 'class'
type StyleSheetWithFlags = typeof StyleSheet & {
  setFlag?: (flag: string, value: string) => void;
};
(StyleSheet as StyleSheetWithFlags).setFlag?.('darkMode', 'class');

// Fix 2 — patch Appearance.set so it never throws on web
type AppearanceWithSet = typeof Appearance & {
  set?: (prefs: { colorScheme: 'dark' | 'light' | null }) => void;
};
const app = Appearance as AppearanceWithSet;
if (typeof app.set === 'function') {
  const original = app.set.bind(app);
  app.set = (prefs) => {
    try {
      original(prefs);
    } catch {
      // Suppress "Cannot manually set color scheme" thrown by RN Web's
      // MutationObserver when NativeWind updates <html class="dark">.
    }
  };
}
