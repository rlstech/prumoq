import { CheckCircle2, ClipboardCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './ui';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../lib/constants';

interface Props {
  onConclude: () => void;
  onDismiss: () => void;
}

export function FVS100PercentBanner({ onConclude, onDismiss }: Props) {
  return (
    <Card tone="success" style={styles.container}>
      <View style={styles.icon}>
        <ClipboardCheck size={26} color={Colors.ok} />
      </View>
      <Text style={styles.title}>Serviço com 100% de execução</Text>
      <Text style={styles.description}>
        Todas as etapas foram executadas. Você pode concluir a FVS agora ou realizar outra verificação.
      </Text>
      <View style={styles.actions}>
        <Button label="Concluir serviço" Icon={CheckCircle2} onPress={onConclude} fullWidth />
        <Button label="Fazer outra verificação" variant="secondary" onPress={onDismiss} fullWidth />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  icon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.heading, color: Colors.ok, fontFamily: FontFamily.bold, textAlign: 'center' },
  description: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', maxWidth: 460 },
  actions: { width: '100%', gap: Spacing.sm, marginTop: Spacing.sm },
});
