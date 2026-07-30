import { useRouter } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Button, Card, ErrorBanner, Field } from '../../components/ui';
import {
  getPasswordAuthErrorMessage,
  markPasswordChanged,
  validateNewPassword,
} from '../../lib/auth/passwords';
import {
  Breakpoints,
  Colors,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '../../lib/constants';
import { db } from '../../lib/powersync';
import { supabase } from '../../lib/supabase';
import { draftStore } from '../../lib/verification/draftStore';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  async function finishGlobalSignOut() {
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id) {
      try {
        await draftStore.deleteForUser(session.user.id);
      } catch {
        // Password security must not be blocked by stale local drafts.
      }
    }
    try {
      await db.disconnectAndClear();
    } catch {
      // The auth session still needs to be revoked if local cleanup fails.
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      setError(
        'A senha foi alterada, mas não foi possível encerrar todas as sessões. Tente novamente.',
      );
      setLoading(false);
      return;
    }

    router.replace('/(auth)/login');
  }

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

    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    if (updateError) {
      setError(getPasswordAuthErrorMessage(updateError.message));
      setLoading(false);
      return;
    }

    await markPasswordChanged();
    setPasswordChanged(true);
    await finishGlobalSignOut();
  }

  return (
    <SafeAreaView style={styles.safe}>
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
                Depois da alteração, será necessário entrar novamente em todos os dispositivos.
              </Text>
            </View>

            {error ? <ErrorBanner message={error} /> : null}

            {passwordChanged ? (
              <Button
                label="Encerrar sessões e voltar ao login"
                onPress={finishGlobalSignOut}
                loading={loading}
                fullWidth
              />
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
