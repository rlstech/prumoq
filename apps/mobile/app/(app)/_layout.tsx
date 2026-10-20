import { Slot } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSessao } from '../../lib/auth/sessao';
import { Colors } from '../../lib/constants';

// As telas do app só montam com a sessão ativa (online ou aberta offline com a conta do aparelho).
// Sem sessão, o layout raiz leva para o login.
export default function AppLayout() {
  const { estado } = useSessao();
  if (estado.fase === 'ativa') return <Slot />;
  if (estado.fase === 'iniciando') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.brand} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
});
