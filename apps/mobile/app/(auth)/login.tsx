import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ClipboardCheck, Plumb, ShieldCheck, WifiOff } from '../../lib/icons';
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
import { Button, ErrorBanner, Field, Pill } from '../../components/ui';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { confirmarCodigo, entrarComSenha, mensagemDoErro, type ResultadoEtapa } from '../../lib/auth/fluxo-login';
import { useSessao } from '../../lib/auth/sessao';
import {
  Breakpoints,
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
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.shell, isTablet && styles.shellTablet]}>
            <View style={[styles.hero, isTablet && styles.heroTablet]}>
              <View style={styles.brand}>
                <View style={styles.plumbMark}>
                  <Plumb size={44} color={Palette.accent} strokeWidth={1.7} />
                </View>
                <BrandWordmark fontSize={30} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>Qualidade em campo</Text>
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
                <Text style={styles.formEyebrow}>Acesso do inspetor</Text>
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
  return <Pill label={text} Icon={Icon} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  scrollTablet: { padding: Spacing.xxxl },
  shell: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: Spacing.xxl,
  },
  shellTablet: {
    maxWidth: Breakpoints.maxContent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 56,
  },
  // Trena Suave: o herói fica direto no concreto; só o formulário é cartão.
  hero: { gap: Spacing.xl },
  heroTablet: { flex: 1.05 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  plumbMark: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { gap: Spacing.sm, maxWidth: 500 },
  eyebrow: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semibold,
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1,
    color: Colors.text,
  },
  heroDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    maxWidth: 460,
  },
  trustList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  formPanel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.xl,
  },
  formPanelTablet: {
    flex: 0.95,
    padding: 48,
  },
  formHeader: { gap: 6 },
  formEyebrow: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semibold,
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
  support: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
