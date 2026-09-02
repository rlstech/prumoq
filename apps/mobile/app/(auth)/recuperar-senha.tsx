import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CheckCircle2, KeyRound, Mail } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../../components/BrandMark';
import { Button, ErrorBanner, Field } from '../../components/ui';
import {
  getPasswordRecoveryRedirectUrl,
  getPasswordRecoveryRequestErrorMessage,
  validateRecoveryEmail,
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

export default function RecoverPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    const validationError = validateRecoveryEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: getPasswordRecoveryRedirectUrl() },
      );
      if (resetError) {
        setError(getPasswordRecoveryRequestErrorMessage(resetError.message));
        return;
      }
      setSent(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '';
      setError(getPasswordRecoveryRequestErrorMessage(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <BrandMark size={36} />
              <Text style={styles.brandName}>PrumoQ</Text>
            </View>

            {sent ? (
              <View style={styles.content}>
                <View style={[styles.iconBox, styles.successIcon]}>
                  <CheckCircle2 size={28} color={Colors.ok} />
                </View>
                <Text style={styles.title}>Verifique seu e-mail</Text>
                <Text style={styles.description}>
                  Se houver uma conta associada ao endereço informado, você receberá um link
                  para criar uma nova senha.
                </Text>
                <View style={styles.notice}>
                  <Mail size={18} color={Colors.textSecondary} />
                  <Text style={styles.noticeText}>
                    O link é temporário. Verifique também a caixa de spam.
                  </Text>
                </View>
                <Button
                  label="Voltar para o login"
                  onPress={() => router.replace('/(auth)/login')}
                  fullWidth
                />
                <Button
                  label="Enviar novamente"
                  onPress={() => setSent(false)}
                  variant="ghost"
                  fullWidth
                />
              </View>
            ) : (
              <View style={styles.content}>
                <View style={styles.iconBox}>
                  <KeyRound size={27} color={Colors.brand} />
                </View>
                <View>
                  <Text style={styles.eyebrow}>RECUPERAÇÃO DE ACESSO</Text>
                  <Text style={styles.title}>Esqueceu sua senha?</Text>
                  <Text style={styles.description}>
                    Informe seu e-mail. Enviaremos um link seguro para você criar uma nova senha.
                  </Text>
                </View>

                <Field
                  label="E-mail"
                  value={email}
                  onChangeText={value => {
                    setEmail(value);
                    setError(null);
                  }}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />

                {error ? <ErrorBanner message={error} /> : null}

                <Button
                  label="Enviar link de recuperação"
                  onPress={handleSubmit}
                  loading={loading}
                  fullWidth
                />

                <TouchableOpacity
                  accessibilityRole="link"
                  onPress={() => router.replace('/(auth)/login')}
                  style={styles.backLink}
                >
                  <Text style={styles.backLinkText}>Voltar para o login</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
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
  eyebrow: {
    ...Typography.overline,
    color: Colors.brand,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.title,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  description: { ...Typography.body, color: Colors.textSecondary },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    padding: Spacing.md,
  },
  noticeText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  backLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLinkText: {
    color: Colors.brand,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
});
