import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { AppHeader } from '../../../components/AppHeader';
import { DIAS, HistoricoPainel } from '../../../components/historico/HistoricoPainel';
import { Screen } from '../../../components/ui';
import { Breakpoints, Spacing } from '../../../lib/constants';

/** Verificações recentes de todas as obras do usuário (atalho do Início). */
export default function HistoricoScreen() {
  const router = useRouter();
  return (
    <Screen>
      <AppHeader
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)' as never))}
        title="Histórico"
        subtitle={`Verificações dos últimos ${DIAS} dias nas suas obras`}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
        <HistoricoPainel />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
});
