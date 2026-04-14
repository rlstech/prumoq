import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing } from '../../lib/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  function validateFields(): string | null {
    if (!email.trim()) return 'Informe o e-mail';
    if (!EMAIL_RE.test(email.trim())) return 'E-mail inválido';
    if (!password) return 'Informe a senha';
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres';
    return null;
  }

  async function handleLogin() {
    const fieldError = validateFields();
    if (fieldError) {
      setError(fieldError);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    console.log('[Login] signIn result:', authData?.user?.id ?? 'no user', authError?.message ?? 'no error');

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check profile — inspetor, admin e gestor podem acessar o mobile
    if (authData.user) {
      const { data: perfilData, error: perfilError } = await supabase
        .from('usuarios' as never)
        .select('perfil')
        .eq('id', authData.user.id)
        .single();

      console.log('[Login] perfil check:', perfilData, perfilError?.message ?? 'no error');

      const perfil = perfilData as { perfil: string } | null;
      const allowedPerfis = ['inspetor', 'admin', 'gestor'];
      if (perfil && !allowedPerfis.includes(perfil.perfil)) {
        setError('Perfil sem acesso ao aplicativo.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
    }

    // Navigate only after profile check passes — avoids the race condition
    // where SIGNED_IN fires before the check completes.
    console.log('[Login] navigating to tabs');
    setLoading(false);
    router.replace('/(app)/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.logo}>PrumoQ</Text>
        <Text style={styles.subtitle}>Gestão da Qualidade para Obras</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Entrar na conta</Text>

        <View style={styles.field}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null); }}
            placeholder="seu@email.com"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null); }}
            placeholder="••••••••"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: 24,
    width: '100%',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 20,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  input: {
    borderWidth: 0.5,
    borderColor: Colors.borderNormal,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
  },
  error: {
    fontSize: 12,
    color: Colors.nok,
    marginBottom: 10,
  },
  button: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
