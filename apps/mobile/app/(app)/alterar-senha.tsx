import { useRouter } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { Button, Card, ErrorBanner, Field, Toast } from '../../components/ui';
import { clerkCarregado } from '../../lib/auth/clerk';
import { isClerkAPIResponseError } from '@clerk/clerk-js/headless';
import { mensagemDoErro } from '../../lib/auth/fluxo-login';
import { validateNewPassword } from '../../lib/auth/passwords';
import {
  Breakpoints,
  Colors,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '../../lib/constants';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  async function handleSubmit() {
    const validationError = validateNewPassword(
      newPassword,
      confirmation,
      currentPassword,
    );
    if (!currentPassword) {
      setError('Informe sua senha atual');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }

    const user = clerkCarregado()?.user;
    if (!user) {
      setError('É necessário estar online para alterar a senha.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Mantém esta sessão (e os dados locais); encerra a conta nos outros aparelhos.
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true });
      setPasswordChanged(true);
    } catch (err) {
      const senhaAtualErrada = isClerkAPIResponseError(err)
        && ['form_password_incorrect', 'form_password_validation_failed'].includes(err.errors[0]?.code ?? '');
      setError(senhaAtualErrada ? 'A senha atual está incorreta.' : mensagemDoErro(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <AppHeader
        title="Alterar senha"
        subtitle="Atualize suas credenciais de acesso."
        showBack
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <View style={styles.iconBox}>
              <KeyRound size={26} color={Colors.brand} />
            </View>
            <View style={styles.heading}>
              <Text style={styles.title}>Proteja sua conta</Text>
              <Text style={styles.description}>
                A nova senha deve ter pelo menos 8 caracteres e ser diferente da atual.
              </Text>
            </View>

            <View style={styles.fields}>
              <Field
                label="Senha atual"
                value={currentPassword}
                onChangeText={value => {
                  setCurrentPassword(value);
                  setError(null);
                }}
                secureTextEntry
                autoComplete="current-password"
                editable={!passwordChanged}
              />
              <Field
                label="Nova senha"
                value={newPassword}
                onChangeText={value => {
                  setNewPassword(value);
                  setError(null);
                }}
                secureTextEntry
                autoComplete="new-password"
                hint="Mínimo de 8 caracteres"
                editable={!passwordChanged}
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
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!passwordChanged}
              />
            </View>

            <View style={styles.securityNotice}>
              <ShieldCheck size={18} color={Colors.textSecondary} />
              <Text style={styles.securityText}>
                Depois da alteração, os outros aparelhos conectados com esta conta precisarão entrar de novo.
              </Text>
            </View>

            {error ? <ErrorBanner message={error} /> : null}

            {passwordChanged ? (
              <>
                <Toast message="Senha alterada." tone="success" />
                <Button label="Voltar" onPress={() => router.back()} fullWidth />
              </>
            ) : (
              <Button
                label="Alterar senha"
                onPress={handleSubmit}
                loading={loading}
                fullWidth
              />
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: Breakpoints.maxForm,
    alignSelf: 'center',
    padding: Spacing.lg,
  },
  card: { gap: Spacing.lg },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandLight,
  },
  heading: { gap: Spacing.xs },
  title: { ...Typography.heading, color: Colors.text },
  description: { ...Typography.body, color: Colors.textSecondary },
  fields: { gap: Spacing.lg },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
  },
  securityText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
});
