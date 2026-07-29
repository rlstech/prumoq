import { router, type Href } from 'expo-router';

/**
 * Volta pela pilha do Expo Router em todas as plataformas.
 * Se a rota foi aberta diretamente e não há histórico interno, usa o destino
 * hierárquico informado pela tela.
 */
export function goBack(fallback: Href = '/(app)/(tabs)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
