import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';

const gold   = '#F9A825';
const goldBg = '#FFF8E1';
const green  = Colors.ok;

interface Props {
  onConclude: () => void;
  onDismiss: () => void;
}

export function FVS100PercentBanner({ onConclude, onDismiss }: Props) {
  return (
    <View style={st.container}>
      <Text style={st.icon}>🎯</Text>
      <Text style={st.title}>Serviço a 100%!</Text>
      <Text style={st.sub}>
        Todas as etapas foram executadas.{'\n'}Deseja concluir este serviço?
      </Text>
      <Pressable style={[st.btn, { backgroundColor: green }]} onPress={onConclude}>
        <Text style={st.btnText}>✓ Concluir serviço agora</Text>
      </Pressable>
      <Pressable style={[st.btn, st.btnGhost]} onPress={onDismiss}>
        <Text style={st.btnGhostText}>Fazer mais uma verificação</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    backgroundColor: goldBg,
    borderWidth: 1.5,
    borderColor: gold,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  icon:  { fontSize: 32, marginBottom: 2 },
  title: { fontSize: FontSizes.md, fontWeight: '700', color: '#5D4037' },
  sub:   { fontSize: FontSizes.sm, color: '#6D4C41', textAlign: 'center', lineHeight: 20 },
  btn: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  btnText:      { color: '#fff', fontWeight: '600', fontSize: FontSizes.sm },
  btnGhost:     { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.text, fontWeight: '500', fontSize: FontSizes.sm },
});
