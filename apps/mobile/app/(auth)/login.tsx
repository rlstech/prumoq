import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ClipboardCheck, HardHat, ShieldCheck, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrandMark } from '../../components/BrandMark';
import { Button, ErrorBanner, Field, Toast } from '../../components/ui';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { consumePasswordChanged } from '../../lib/auth/passwords';
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void consumePasswordChanged().then(setPasswordChanged);
  }, []);

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

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const { data: perfilData } = await supabase
        .from('usuarios' as never)
        .select('perfil')
        .eq('id', authData.user.id)
        .single();

      const perfil = perfilData as { perfil: string } | null;
      if (perfil && !['inspetor', 'admin', 'gestor'].includes(perfil.perfil)) {
        setError('Perfil sem acesso ao aplicativo.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.replace('/(app)/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={isTablet ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.shell, isTablet && styles.shellTablet]}>
          <View style={[styles.hero, isTablet && styles.heroTablet]}>
            <View style={styles.brand}>
              <BrandMark size={38} variant="onBrand" />
              <Text style={styles.logo}>PrumoQ</Text>
            </View>
            <View style={styles.heroCopy}>
              <View style={styles.heroIcon}>
                <HardHat size={30} color={Colors.brandSignature} />
              </View>
              <Text style={styles.eyebrow}>QUALIDADE EM CAMPO</Text>
              <Text style={styles.heroTitle}>Verificações claras, mesmo sem conexão.</Text>
              <Text style={styles.heroDescription}>
                Registre serviços, evidências e não conformidades com segurança durante toda a inspeção.
              </Text>
            </View>
            <View style={styles.trustList}>
              <TrustItem Icon={ClipboardCheck} text="Fluxo guiado de verificação" />
              <TrustItem Icon={WifiOff} text="Trabalho offline com sincronização" />
              <TrustItem Icon={ShieldCheck} text="Dados protegidos por obra" />
            </View>
          </View>

          <View style={[styles.formPanel, isTablet && styles.formPanelTablet]}>
            <View style={styles.formHeader}>
              <Text style={styles.formEyebrow}>ACESSO DO INSPETOR</Text>
              <Text style={styles.formTitle}>Entrar na conta</Text>
              <Text style={styles.formDescription}>
                Use suas credenciais do PrumoQ para continuar o trabalho de campo.
              </Text>
            </View>

            <View style={styles.fields}>
              <Field
                label="E-mail"
                value={email}
                onChangeText={value => { setEmail(value); setError(null); }}
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
              <Field
                label="Senha"
                value={password}
                onChangeText={value => { setPassword(value); setError(null); }}
                placeholder="Digite sua senha"
                secureTextEntry
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? <ErrorBanner message={error} /> : null}
            {passwordChanged ? (
              <Toast
                message="Senha alterada. Entre novamente com sua nova senha."
                tone="success"
                onDismiss={() => setPasswordChanged(false)}
              />
            ) : null}

            <Button
              label="Entrar no PrumoQ"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              accessibilityHint="Autentica e abre o painel de campo"
            />

            <TouchableOpacity
              accessibilityRole="link"
              onPress={() => router.push('/(auth)/recuperar-senha')}
              style={styles.recoveryLink}
            >
              <Text style={styles.recoveryLinkText}>Esqueci minha senha</Text>
            </TouchableOpacity>

            <Text style={styles.support}>
              Outros problemas com o acesso? Fale com o administrador da sua empresa.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TrustItem({ Icon, text }: { Icon: typeof ClipboardCheck; text: string }) {
  return (
    <View style={styles.trustItem}>
      <View style={styles.trustIcon}><Icon size={17} color={Colors.brandSignature} /></View>
      <Text style={styles.trustText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  scrollTablet: { backgroundColor: Colors.text, padding: Spacing.xxxl },
  shell: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: Spacing.xl,
  },
  shellTablet: {
    maxWidth: Breakpoints.maxContent,
    minHeight: 680,
    flexDirection: 'row',
    gap: 0,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Elevation.floating,
  },
  hero: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.text,
    padding: Spacing.xxl,
    gap: Spacing.xxl,
    overflow: 'hidden',
  },
  heroTablet: {
    flex: 1.08,
    borderRadius: 0,
    padding: 48,
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: {
    color: Colors.surface,
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xxl,
    letterSpacing: -0.6,
  },
  heroCopy: { gap: Spacing.sm, maxWidth: 500 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(216,229,104,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  eyebrow: {
    ...Typography.caption,
    color: Colors.brandSignature,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.9,
    color: Colors.surface,
  },
  heroDescription: {
    ...Typography.body,
    color: Colors.borderNormal,
    maxWidth: 460,
  },
  trustList: { gap: Spacing.sm },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(216,229,104,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: { ...Typography.caption, color: Colors.border, fontFamily: FontFamily.medium },
  formPanel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  formPanelTablet: {
    flex: 0.92,
    borderRadius: 0,
    borderWidth: 0,
    padding: 56,
    justifyContent: 'center',
  },
  formHeader: { gap: 6 },
  formEyebrow: {
    ...Typography.caption,
    color: Colors.brand,
    fontFamily: FontFamily.bold,
    letterSpacing: 1,
  },
  formTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 38,
    color: Colors.text,
    letterSpacing: -0.7,
  },
  formDescription: { ...Typography.body, color: Colors.textSecondary },
  fields: { gap: Spacing.lg },
  recoveryLink: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryLinkText: {
    color: Colors.brand,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  support: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
