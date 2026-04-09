import { View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../../../../lib/constants';

export default function ObrasScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Obras</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.placeholder}>Em construção — Fase 2.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.brand },
  topbar: {
    backgroundColor: Colors.brand,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  title: { color: '#fff', fontSize: 19, fontWeight: '500' },
  body: { flex: 1, backgroundColor: Colors.bg, padding: 16 },
  placeholder: { color: Colors.textSecondary, fontSize: 13 },
});
