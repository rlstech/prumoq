
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/compat/navigation';
import { useAuth, useClerk, useSignIn } from '@clerk/clerk-react';
import { isClerkAPIResponseError } from '@clerk/clerk-react/errors';
import { CheckCircle2 } from 'lucide-react';
import { minimumPasswordSchema } from '@/lib/auth/passwords';
import { verificarAcesso } from './actions';

type Etapa = 'entrar' | 'codigo' | 'esqueci' | 'redefinir';

const MOTIVOS: Record<string, string> = {
  inativo: 'Usuário inativo. Fale com o administrador.',
  inspetor: 'Acesso restrito. Use o aplicativo móvel.',
  semcliente: 'Conta sem cliente vinculado.',
  suspenso: 'Ambiente suspenso. Fale com o suporte PrumoQ.',
};

function mensagemDoErro(err: unknown): string {
  if (isClerkAPIResponseError(err)) {
    const code = err.errors[0]?.code ?? '';
    if (['form_password_incorrect', 'form_identifier_not_found', 'strategy_for_user_invalid'].includes(code)) {
      return 'E-mail ou senha inválidos.';
    }
    if (code === 'form_code_incorrect' || code === 'verification_failed') return 'Código inválido ou expirado.';
    if (code === 'form_password_pwned') return 'Esta senha apareceu em vazamentos conhecidos. Escolha outra.';
    if (code === 'form_password_length_too_short' || code === 'form_password_not_strong_enough') {
      return 'A nova senha não atende à política de segurança.';
    }
    if (code === 'too_many_requests') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (code === 'user_locked') return 'Conta temporariamente bloqueada por excesso de tentativas.';
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}

export default function LoginForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  const [etapa, setEtapa] = useState<Etapa>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [senhaAlterada, setSenhaAlterada] = useState(false);

  // Reage à URL, não só à montagem: o Clerk volta para `/login?motivo=...` por navegação do cliente,
  // sem remontar o formulário. Lendo uma vez, a mensagem de bloqueio (ex.: inspetor) nunca aparecia.
  const searchParams = useSearchParams();
  const motivoUrl = searchParams.get('motivo');
  const senhaUrl = searchParams.get('senha');
  useEffect(() => {
    setSenhaAlterada(senhaUrl === 'alterada');
    if (motivoUrl && MOTIVOS[motivoUrl]) {
      setErro(MOTIVOS[motivoUrl]);
      setEtapa('entrar');
      setCodigo('');
    }
  }, [motivoUrl, senhaUrl]);

  // Uma saída só: o middleware (`?sair=1`) e o `concluir` podem decidir encerrar a sessão ao mesmo tempo
  // (ex.: inspetor). Duas chamadas a signOut concorrentes fazem a segunda falhar com erro genérico.
  const saida = useRef<Promise<void> | null>(null);
  const sair = useCallback((motivo: string | null) => {
    const redirectUrl = `/admin/login${motivo ? `?motivo=${encodeURIComponent(motivo)}` : ''}`;
    saida.current ??= signOut({ redirectUrl })
      .catch(() => {
        // sessão já encerrada por outro caminho: só leva para a tela de login com o motivo
        window.location.assign(redirectUrl);
      })
      .finally(() => {
        saida.current = null; // permite nova tentativa de login na mesma tela
      });
    return saida.current;
  }, [signOut]);

  // `?sair=1`: o middleware/servidor pediu para encerrar a sessão do Clerk (que só o navegador consegue).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sair') !== '1' || !isSignedIn) return;
    void sair(params.get('motivo'));
  }, [isSignedIn, sair]);

  async function concluir(sessionId: string | null) {
    if (!sessionId || !setActive) throw new Error('sessao');
    await setActive({ session: sessionId });
    let resultado = await verificarAcesso();
    if (!resultado.success && resultado.motivo === 'sessao') {
      // o cookie da sessão pode levar um instante para chegar ao servidor
      await new Promise(resolve => setTimeout(resolve, 400));
      resultado = await verificarAcesso();
    }
    if (resultado.success) {
      router.push(resultado.destination);
      return;
    }
    await sair(resultado.motivo);
  }

  async function seguir(res: { status: string | null; createdSessionId: string | null }) {
    if (!signIn) return;
    if (res.status === 'complete') return concluir(res.createdSessionId);
    if (res.status === 'needs_second_factor' || res.status === 'needs_client_trust') {
      await signIn.prepareSecondFactor({ strategy: 'email_code' });
      setCodigo('');
      setEtapa('codigo');
      return;
    }
    setErro('Não foi possível concluir o acesso. Use "Esqueci minha senha" ou fale com o administrador.');
  }

  async function executar(acao: () => Promise<void>) {
    if (!isLoaded || ocupado) return;
    setErro(null);
    setOcupado(true);
    try {
      await acao();
    } catch (err) {
      setErro(mensagemDoErro(err));
    } finally {
      setOcupado(false);
    }
  }

  const entrar = (event: React.FormEvent) => {
    event.preventDefault();
    void executar(async () => seguir(await signIn!.create({ identifier: email.trim().toLowerCase(), password: senha })));
  };

  const confirmarCodigo = (event: React.FormEvent) => {
    event.preventDefault();
    void executar(async () => seguir(await signIn!.attemptSecondFactor({ strategy: 'email_code', code: codigo.trim() })));
  };

  const pedirRedefinicao = (event: React.FormEvent) => {
    event.preventDefault();
    void executar(async () => {
      await signIn!.create({ strategy: 'reset_password_email_code', identifier: email.trim().toLowerCase() });
      setCodigo('');
      setNovaSenha('');
      setEtapa('redefinir');
    });
  };

  const redefinir = (event: React.FormEvent) => {
    event.preventDefault();
    const validacao = minimumPasswordSchema.safeParse(novaSenha);
    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? 'Revise a nova senha.');
      return;
    }
    void executar(async () =>
      seguir(await signIn!.attemptFirstFactor({ strategy: 'reset_password_email_code', code: codigo.trim(), password: novaSenha })),
    );
  };

  const titulo: Record<Etapa, string> = {
    entrar: 'Bem-vindo de volta.',
    codigo: 'Confirme o seu acesso.',
    esqueci: 'Recuperar senha.',
    redefinir: 'Defina a nova senha.',
  };
  const subtitulo: Record<Etapa, string> = {
    entrar: 'Entre com suas credenciais para continuar a operação.',
    codigo: 'Enviamos um código de verificação para o seu e-mail.',
    esqueci: 'Informe o e-mail da conta para receber um código de redefinição.',
    redefinir: 'Digite o código recebido por e-mail e escolha uma nova senha.',
  };

  return (
    <>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] text-txt">{titulo[etapa]}</h2>
      <p className="mt-2 text-sm text-txt-2">{subtitulo[etapa]}</p>

      <form
        onSubmit={{ entrar, codigo: confirmarCodigo, esqueci: pedirRedefinicao, redefinir }[etapa]}
        className="mt-9 flex flex-col gap-5"
      >
        {(etapa === 'entrar' || etapa === 'esqueci') && (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-txt">E-mail corporativo</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="prumo-field"
              placeholder="voce@empresa.com.br"
              required
              autoComplete="email"
            />
          </label>
        )}

        {etapa === 'entrar' && (
          <label className="space-y-2">
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-txt">
              Senha
              <button
                type="button"
                onClick={() => { setErro(null); setEtapa('esqueci'); }}
                className="font-medium text-[var(--prumo-brand)] hover:underline"
              >
                Esqueci minha senha
              </button>
            </span>
            <input
              type="password"
              name="password"
              value={senha}
              onChange={event => setSenha(event.target.value)}
              className="prumo-field"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>
        )}

        {(etapa === 'codigo' || etapa === 'redefinir') && (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-txt">Código de verificação</span>
            <input
              type="text"
              name="codigo"
              inputMode="numeric"
              value={codigo}
              onChange={event => setCodigo(event.target.value)}
              className="prumo-field"
              placeholder="000000"
              required
              autoComplete="one-time-code"
            />
          </label>
        )}

        {etapa === 'redefinir' && (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-txt">Nova senha</span>
            <input
              type="password"
              name="nova-senha"
              value={novaSenha}
              onChange={event => setNovaSenha(event.target.value)}
              className="prumo-field"
              placeholder="Mínimo de 8 caracteres"
              required
              autoComplete="new-password"
            />
          </label>
        )}

        {erro ? (
          <div role="alert" className="rounded-lg border border-nok/20 bg-nok-bg px-4 py-3 text-sm font-medium text-nok">
            {erro}
          </div>
        ) : null}

        {senhaAlterada && etapa === 'entrar' ? (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-ok/20 bg-ok-bg px-4 py-3 text-sm font-medium text-ok">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            Senha alterada. Entre novamente com sua nova senha.
          </div>
        ) : null}

        <button type="submit" disabled={ocupado || !isLoaded} className="prumo-primary-button mt-1 min-h-12 w-full disabled:opacity-60">
          {ocupado
            ? 'Validando acesso…'
            : { entrar: 'Entrar no painel', codigo: 'Confirmar código', esqueci: 'Enviar código', redefinir: 'Redefinir e entrar' }[etapa]}
        </button>

        {etapa !== 'entrar' && (
          <button
            type="button"
            onClick={() => { setErro(null); setEtapa('entrar'); }}
            className="text-sm font-medium text-[var(--prumo-brand)] hover:underline"
          >
            Voltar para o login
          </button>
        )}
      </form>
    </>
  );
}
