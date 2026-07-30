import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CheckCircle2, KeyRound, Link2Off, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BrandMark } from '../../components/BrandMark';
import { Button, ErrorBanner, Field } from '../../components/ui';
import {
  clearPasswordRecoverySession,
  getPasswordAuthErrorMessage,
  getPublicPwaOrigin,
  isMarkedPasswordRecoverySession,
  markPasswordRecoverySession,
  validateNewPassword,
} from '../../lib/auth/passwords';
import {
  Breakpoints,
  Colors,
  Elevation,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../lib/constants';
import { supabase } from '../../lib/supabase';

type RecoveryStatus = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<RecoveryStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        markPasswordRecoverySession(session.user.id);
        setStatus('ready');
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session && isMarkedPasswordRecoverySession(session.user.id)) {
        setStatus('ready');
      } else {
        setStatus(current => current === 'ready' ? current : 'invalid');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function finishGlobalSignOut(): Promise<boolean> {
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      setWarning(
        'A senha foi alterada, mas não foi possível confirmar o encerramento das outras sessões.',
      );
      return false;
    }
    clearPasswordRecoverySession();
    setWarning(null);
    return true;
  }

  async function retryGlobalSignOut() {
    setLoading(true);
    await finishGlobalSignOut();
    setLoading(false);
  }

  async function handleUpdatePassword() {
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !isMarkedPasswordRecoverySession(session.user.id)) {
      setStatus('invalid');
      return;
    }

    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(getPasswordAuthErrorMessage(updateError.message));
      setLoading(false);
      return;
    }

    await finishGlobalSignOut();
    setLoading(false);
    setStatus('success');
  }

  async function openAdminLogin() {
    await Linking.openURL(`${getPublicPwaOrigin()}/admin/login`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <BrandMark size={36} />
              <Text style={styles.brandName}>PrumoQ</Text>
            </View>

            {status === 'checking' ? (
              <View style={styles.content}>
                <View style={styles.iconBox}>
                  <ShieldCheck size={28} color={Colors.brand} />
                </View>
                <Text style={styles.title}>Validando link seguro…</Text>
                <Text style={styles.description}>Aguarde enquanto confirmamos sua solicitação.</Text>
              </View>
            ) : null}

            {status === 'invalid' ? (
              <View style={styles.content}>
                <View style={[styles.iconBox, styles.errorIcon]}>
                  <Link2Off size={28} color={Colors.nok} />
                </View>
                <Text style={styles.title}>Link inválido ou expirado</Text>
                <Text style={styles.description}>
                  Solicite um novo e-mail de recuperação. Por segurança, cada link pode ser usado
                  somente durante um período limitado.
                </Text>
                <Button
                  label="Solicitar novo link"
                  onPress={() => router.replace('/(auth)/recuperar-senha')}
                  fullWidth
                />
                <Button
                  label="Voltar para o login"
                  onPress={() => router.replace('/(auth)/login')}
                  variant="ghost"
                  fullWidth
                />
              </View>
            ) : null}

            {status === 'ready' ? (
              <View style={styles.content}>
                <View style={styles.iconBox}>
                  <KeyRound size={28} color={Colors.brand} />
                </View>
                <View>
                  <Text style={styles.eyebrow}>NOVAS CREDENCIAIS</Text>
                  <Text style={styles.title}>Crie uma nova senha</Text>
                  <Text style={styles.description}>
                    Use pelo menos 8 caracteres. Ao concluir, suas sessões abertas serão encerradas.
                  </Text>
                </View>
                <Field
                  label="Nova senha"
                  value={password}
                  onChangeText={value => {
                    setPassword(value);
                    setError(null);
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                />
                <Field
                  label="Confirmar nova senha"
                  value={confirmation}
                  onChangeText={value => {
                    setConfirmation(value);
                    setError(null);
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Digite a nova senha novamente"
                  returnKeyType="done"
                  onSubmitEditing={handleUpdatePassword}
                />
                {error ? <ErrorBanner message={error} /> : null}
                <Button
                  label="Salvar nova senha"
                  onPress={handleUpdatePassword}
                  loading={loading}
                  fullWidth
                />
              </View>
            ) : null}

            {status === 'success' ? (
              <View style={styles.content}>
                <View style={[styles.iconBox, styles.successIcon]}>
                  <CheckCircle2 size={28} color={Colors.ok} />
                </View>
                <Text style={styles.title}>Senha alterada</Text>
                <Text style={styles.description}>
                  Entre novamente usando sua nova senha.
                </Text>
                {warning ? <ErrorBanner message={warning} /> : null}
                {warning ? (
                  <Button
                    label="Tentar encerrar sessões novamente"
                    onPress={retryGlobalSignOut}
                    loading={loading}
                    fullWidth
                  />
                ) : (
                  <>
                    <Button
                      label="Entrar no aplicativo"
                      onPress={() => router.replace('/(auth)/login')}
                      fullWidth
                    />
                    <Button
                      label="Entrar no painel administrativo"
                      onPress={openAdminLogin}
                      variant="secondary"
                      fullWidth
                    />
                  </>
                )}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  card: {
    width: '100%',
    maxWidth: Breakpoints.maxForm,
    alignSelf: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.xxl,
    gap: Spacing.xxl,
    ...Elevation.floating,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  brandName: {
    color: Colors.text,
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xl,
    letterSpacing: -0.5,
  },
  content: { gap: Spacing.lg },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandLight,
  },
  successIcon: { backgroundColor: Colors.okBg },
  errorIcon: { backgroundColor: Colors.nokBg },
  eyebrow: { ...Typography.overline, color: Colors.brand, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.text, marginBottom: Spacing.xs },
  description: { ...Typography.body, color: Colors.textSecondary },
});
