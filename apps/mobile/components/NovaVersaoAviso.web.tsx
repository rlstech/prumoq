import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Toast } from './ui';

/**
 * Aviso de versão nova do app (o service worker já baixou e guardou a versão; ver lib/setup-rn-web.ts).
 * Não recarrega sozinho: a pessoa pode estar no meio de uma verificação. Rascunhos ficam salvos no aparelho.
 */
export function NovaVersaoAviso() {
  const [disponivel, setDisponivel] = useState(
    () => !!(window as unknown as { __prumoqNovaVersao?: boolean }).__prumoqNovaVersao,
  );
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    const aoChegar = () => setDisponivel(true);
    window.addEventListener('prumoq:nova-versao', aoChegar);
    return () => window.removeEventListener('prumoq:nova-versao', aoChegar);
  }, []);

  if (!disponivel || dispensado) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Toast
        tone="info"
        message="Nova versão do PrumoQ disponível."
        actionLabel="Atualizar"
        onAction={() => window.location.reload()}
        onDismiss={() => setDispensado(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Acima da barra de abas flutuante, sem empurrar o conteúdo.
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 104,
    zIndex: 50,
  },
});
