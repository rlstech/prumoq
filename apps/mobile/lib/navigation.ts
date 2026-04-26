import { Platform } from 'react-native';
import { router } from 'expo-router';

/**
 * Navega para a tela anterior de forma correta em web e nativo.
 *
 * No web (PWA) o router.back() opera no stack do React Navigation, que não
 * reflete travessias entre tabs (ex: NC → obra). window.history.back() usa o
 * histórico real do browser e sempre volta para a URL anterior correta.
 */
export function goBack() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      router.replace('/(app)/(tabs)' as never);
    }
  } else {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)' as never);
    }
  }
}
