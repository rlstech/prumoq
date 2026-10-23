import { useQuery } from '@powersync/react';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSessao } from '../../lib/auth/sessao';
import { Colors } from '../../lib/constants';
import { ensureDefaultSignature } from '../../lib/signature-defaults';

// As telas do app só montam com a sessão ativa (online ou aberta offline com a conta do aparelho).
// Sem sessão, o layout raiz leva para o login.
export default function AppLayout() {
  const { estado } = useSessao();
  if (estado.fase === 'ativa') {
    return (
      <>
        <PreparaAssinaturaOffline usuarioId={estado.conta.usuarioId} online={estado.online} />
        <Slot />
      </>
    );
  }
  if (estado.fase === 'iniciando') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.brand} />
      </View>
    );
  }
  return null;
}

/**
 * A assinatura padrão fica numa cópia local (IndexedDB) que a saída da conta apaga. Sem isto ela só voltava
 * quando uma tela de verificação era aberta com internet, e uma verificação feita offline logo depois de
 * entrar não achava a assinatura. Baixa assim que houver sessão online; sem efeito se a cópia já existe.
 */
function PreparaAssinaturaOffline({ usuarioId, online }: { usuarioId: string; online: boolean }) {
  const { data } = useQuery<{ assinatura_padrao_url: string | null }>(
    'SELECT assinatura_padrao_url FROM usuarios WHERE id = ? LIMIT 1',
    [usuarioId],
  );
  const chave = data[0]?.assinatura_padrao_url ?? null;

  useEffect(() => {
    if (!chave) return;
    const preparar = () => { void ensureDefaultSignature(usuarioId, chave); };
    if (online) preparar();
    // Se a primeira tentativa cair sem rede, tenta de novo quando a internet voltar.
    if (typeof window === 'undefined') return;
    window.addEventListener('online', preparar);
    return () => window.removeEventListener('online', preparar);
  }, [online, chave, usuarioId]);

  return null;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
});
