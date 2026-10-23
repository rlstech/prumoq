import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { BrandMark } from '../../components/BrandMark';
import { useEffect, useRef, useState } from 'react';
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

import { BrandWordmark } from '../../components/BrandWordmark';
import { Button, ErrorBanner, Field } from '../../components/ui';
import { confirmarCodigo, entrarComSenha, mensagemDoErro, type ResultadoEtapa } from '../../lib/auth/fluxo-login';
import { useSessao } from '../../lib/auth/sessao';
import {
  Colors,

  FontFamily,
  FontSizes,
  Palette,
  Radius,
  Spacing,
  Typography,

} from '../../lib/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { estado, concluirLogin } = useSessao();
  const contaDoAparelho = estado.fase === 'expirada' ? estado.conta : null;
  const avisoSessao = estado.fase === 'expirada' || estado.fase === 'deslogado' ? estado.aviso : null;
  const [email, setEmail] = useState(contaDoAparelho?.email ?? '');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState<'entrar' | 'codigo'>('entrar');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => {
    if (contaDoAparelho?.email) setEmail(current => current || contaDoAparelho.email || '');
  }, [contaDoAparelho?.email]);

  function validateFields(): string | null {
    if (!email.trim()) return 'Informe o e-mail';
    if (!EMAIL_RE.test(email.trim())) return 'E-mail inválido';
    if (!password) return 'Informe a senha';
    return null;
  }

  async function executar(acao: () => Promise<ResultadoEtapa>) {
    if (ocupado.current) return;
    ocupado.current = true;
    setLoading(true);
    setError(null);
    try {
      const resultado = await acao();
      if (resultado.tipo === 'codigo') {
        setCodigo('');
        setEtapa('codigo');
        return;
      }
      // O layout raiz leva para o app quando a sessão fica ativa.
      await concluirLogin(resultado.sessionId);
    } catch (err) {
      setError(mensagemDoErro(err));
    } finally {
      ocupado.current = false;
      setLoading(false);
    }
  }

  function handleLogin() {
    const fieldError = validateFields();
    if (fieldError) {
      setError(fieldError);
      return;
    }
    void executar(() => entrarComSenha(email, password));
  }

  function handleCodigo() {
    if (!codigo.trim()) {
      setError('Informe o código recebido por e-mail');
      return;
    }
    void executar(() => confirmarCodigo(codigo));
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shell}>
            <View style={styles.brand}>
              <View style={styles.plumbMark}>
                <BrandMark size={50} variant="onBrand" />
              </View>
              <BrandWordmark fontSize={30} />
            </View>

            <View style={styles.formPanel}>
              <Text style={styles.formTitle} accessibilityRole="header">
                {etapa === 'codigo' ? 'Confirme o código' : 'Entrar'}
              </Text>

              {etapa === 'entrar' ? (
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
              ) : (
                <View style={styles.fields}>
                  <Text style={styles.formDescription}>
                    Enviamos um código de verificação para {email.trim().toLowerCase()}.
                  </Text>
                  <Field
                    label="Código de verificação"
                    value={codigo}
                    onChangeText={value => { setCodigo(value); setError(null); }}
                    placeholder="000000"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    returnKeyType="done"
                    onSubmitEditing={handleCodigo}
                  />
                </View>
              )}

              {avisoSessao && !error ? <ErrorBanner message={avisoSessao} /> : null}
              {error ? <ErrorBanner message={error} /> : null}

              {etapa === 'entrar' ? (
                <Button
                  label="Entrar"
                  onPress={handleLogin}
                  loading={loading}
                  fullWidth
                  accessibilityHint="Autentica e abre o painel de campo"
                />
              ) : (
                <Button
                  label="Confirmar código"
                  onPress={handleCodigo}
                  loading={loading}
                  fullWidth
                />
              )}

              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => {
                  if (etapa === 'codigo') {
                    setEtapa('entrar');
                    setError(null);
                  } else {
                    router.push('/(auth)/recuperar-senha');
                  }
                }}
                style={styles.recoveryLink}
              >
                <Text style={styles.recoveryLinkText}>
                  {etapa === 'codigo' ? 'Voltar' : 'Esqueci minha senha'}
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  // Só o essencial: marca, título, campos e o botão.
  shell: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.xxl,
  },
  brand: { alignItems: 'center', gap: Spacing.md },
  plumbMark: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formPanel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.xl,
  },
  formTitle: {
    ...Typography.title,
    color: Colors.text,
  },
  formDescription: { ...Typography.body, color: Colors.textSecondary },
  fields: { gap: Spacing.lg },
  recoveryLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryLinkText: {
    color: Colors.text,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    textDecorationLine: 'underline',
  },
});
