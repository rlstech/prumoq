import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { KeyRound, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
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
  confirmarCodigo,
  mensagemDoErro,
  pedirCodigoRedefinicao,
  redefinirSenha,
  type ResultadoEtapa,
} from '../../lib/auth/fluxo-login';
import { validateNewPassword, validateRecoveryEmail } from '../../lib/auth/passwords';
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

// Recuperação pelo Clerk: código enviado por e-mail + nova senha na mesma tela. Também é o caminho de quem
// recebeu acesso sem senha definida (usuário criado pelo painel).
type Etapa = 'email' | 'redefinir' | 'codigo';

const TITULO: Record<Etapa, string> = {
  email: 'Esqueceu sua senha?',
  redefinir: 'Defina a nova senha',
  codigo: 'Confirme o seu acesso',
};

const BOTAO: Record<Etapa, string> = {
  email: 'Enviar código',
  redefinir: 'Redefinir e entrar',
  codigo: 'Confirmar código',
};

export default function RecoverPasswordScreen() {
  const router = useRouter();
  const { concluirLogin } = useSessao();
  const [etapa, setEtapa] = useState<Etapa>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ocupado = useRef(false);

  async function executar(acao: () => Promise<void>) {
    if (ocupado.current) return;
    ocupado.current = true;
    setLoading(true);
    setError(null);
    try {
      await acao();
    } catch (err) {
      setError(mensagemDoErro(err));
    } finally {
      ocupado.current = false;
      setLoading(false);
    }
  }

  async function seguir(resultado: ResultadoEtapa) {
    if (resultado.tipo === 'codigo') {
      setCodigo('');
      setEtapa('codigo');
      return;
    }
    // O layout raiz leva para o app quando a sessão fica ativa.
    await concluirLogin(resultado.sessionId);
  }

  function pedirCodigo() {
    const validationError = validateRecoveryEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    void executar(async () => {
      await pedirCodigoRedefinicao(email);
      setCodigo('');
      setNovaSenha('');
      setConfirmacao('');
      setEtapa('redefinir');
    });
  }

  function redefinir() {
    if (!codigo.trim()) {
      setError('Informe o código recebido por e-mail');
      return;
    }
    const validationError = validateNewPassword(novaSenha, confirmacao);
    if (validationError) {
      setError(validationError);
      return;
    }
    void executar(async () => seguir(await redefinirSenha(codigo, novaSenha)));
  }

  function confirmar() {
    if (!codigo.trim()) {
      setError('Informe o código recebido por e-mail');
      return;
    }
    void executar(async () => seguir(await confirmarCodigo(codigo)));
  }

  const enviar = { email: pedirCodigo, redefinir, codigo: confirmar }[etapa];
  const descricao = etapa === 'email'
    ? 'Informe seu e-mail. Enviaremos um código para você criar uma nova senha.'
    : etapa === 'redefinir'
      ? `Digite o código enviado para ${email.trim().toLowerCase()} e escolha uma nova senha.`
      : 'Enviamos um código de verificação para o seu e-mail.';

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

            <View style={styles.content}>
              <View style={styles.iconBox}>
                {etapa === 'email'
                  ? <KeyRound size={27} color={Colors.brand} />
                  : <Mail size={27} color={Colors.brand} />}
              </View>
              <View>
                <Text style={styles.eyebrow}>RECUPERAÇÃO DE ACESSO</Text>
                <Text style={styles.title}>{TITULO[etapa]}</Text>
                <Text style={styles.description}>{descricao}</Text>
              </View>

              {etapa === 'email' ? (
                <Field
                  label="E-mail"
                  value={email}
                  onChangeText={value => { setEmail(value); setError(null); }}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={pedirCodigo}
                />
              ) : (
                <Field
                  label="Código de verificação"
                  value={codigo}
                  onChangeText={value => { setCodigo(value); setError(null); }}
                  placeholder="000000"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  returnKeyType={etapa === 'codigo' ? 'done' : 'next'}
                  onSubmitEditing={etapa === 'codigo' ? confirmar : undefined}
                />
              )}

              {etapa === 'redefinir' ? (
                <>
                  <Field
                    label="Nova senha"
                    value={novaSenha}
                    onChangeText={value => { setNovaSenha(value); setError(null); }}
                    secureTextEntry
                    autoComplete="new-password"
                    hint="Mínimo de 8 caracteres"
                  />
                  <Field
                    label="Confirmar nova senha"
                    value={confirmacao}
                    onChangeText={value => { setConfirmacao(value); setError(null); }}
                    secureTextEntry
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={redefinir}
                  />
                  <View style={styles.notice}>
                    <Mail size={18} color={Colors.textSecondary} />
                    <Text style={styles.noticeText}>
                      O código é temporário. Se não chegar, verifique também a caixa de spam.
                    </Text>
                  </View>
                </>
              ) : null}

              {error ? <ErrorBanner message={error} /> : null}

              <Button label={BOTAO[etapa]} onPress={enviar} loading={loading} fullWidth />

              {etapa === 'redefinir' ? (
                <Button
                  label="Enviar novo código"
                  onPress={() => { setEtapa('email'); setError(null); }}
                  variant="ghost"
                  fullWidth
                />
              ) : null}

              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backLink}
              >
                <Text style={styles.backLinkText}>Voltar para o login</Text>
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
