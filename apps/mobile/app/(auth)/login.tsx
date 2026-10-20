import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ClipboardCheck, HardHat, ShieldCheck, WifiOff } from 'lucide-react-native';
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
import { BrandMark } from '../../components/BrandMark';
import { Button, ErrorBanner, Field } from '../../components/ui';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { confirmarCodigo, entrarComSenha, mensagemDoErro, type ResultadoEtapa } from '../../lib/auth/fluxo-login';
import { useSessao } from '../../lib/auth/sessao';
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
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
                  label="Entrar no PrumoQ"
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

              <Text style={styles.support}>
                Outros problemas com o acesso? Fale com o administrador da sua empresa.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
