import { useRouter } from 'expo-router';
import { CloudUpload } from 'lucide-react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../../../components/AppHeader';
import { EmptyState } from '../../../../components/ui';
import { Colors, Spacing } from '../../../../lib/constants';

/**
 * No navegador não existe fila: o shim grava direto no Supabase e um erro
 * aparece na hora, na própria tela que gravou. A quarentena e o
 * `getUploadQueueStats` são do PowerSync, que só roda no app nativo.
 */
export default function SincronizacaoWebScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title="Sincronização"
        subtitle="Fila de envio e registros recusados"
        showBack
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          Icon={CloudUpload}
          title="Sem fila no navegador"
          description="Aqui cada registro vai direto ao servidor e qualquer erro aparece na hora. A fila de envio offline existe apenas no aplicativo instalado."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg },
});
