import { View, Text, SafeAreaView, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../../../../lib/supabase';
import { Colors, Radius, Spacing } from '../../../../lib/constants';

export default function PerfilScreen() {
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>IN</Text>
        </View>
        <Text style={styles.name}>Inspetor</Text>
        <Text style={styles.role}>Inspetor de Campo</Text>
      </View>

      <View style={styles.body}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.brand },
  hero: {
    backgroundColor: Colors.brand,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 30,
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.brand, fontSize: 22, fontWeight: '500' },
  name:       { color: '#fff', fontSize: 18, fontWeight: '500' },
  role:       { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  body: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
  },
  logoutBtn: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.md,
    padding: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { color: Colors.nok, fontSize: 14, fontWeight: '500' },
});
