import { isClerkAPIResponseError } from '@clerk/clerk-js/headless';
import { carregarClerk, type ClerkInstance } from './clerk';

// Etapas de login e de redefinição de senha do Clerk, sem interface. Ao concluir devolvem o id da sessão
// criada; quem chama entrega esse id a `concluirLogin` (lib/auth/sessao.tsx), que confere o acesso no banco.

type SignIn = NonNullable<ClerkInstance['client']>['signIn'];
type RespostaSignIn = Awaited<ReturnType<SignIn['create']>>;

export type ResultadoEtapa =
  | { tipo: 'concluido'; sessionId: string }
  | { tipo: 'codigo' };

let atual: RespostaSignIn | null = null;

async function clerkOnline(): Promise<ClerkInstance> {
  try {
    return await carregarClerk();
  } catch {
    throw new ErroLogin('É necessário estar online para entrar. Depois do primeiro acesso, o app abre sem internet.');
  }
}

export class ErroLogin extends Error {}

export const MSG_BANCO_EM_USO =
  'O PrumoQ está aberto em outra aba ou janela deste navegador. Feche as outras e tente novamente.';

/** O banco local (OPFS) só aceita um dono: outra aba/janela do app aberta impede abrir ou limpar. */
function bancoLocalEmUso(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  return e?.name === 'NoModificationAllowedError'
    || /createSyncAccessHandle|unable to open database file|Access Handle/i.test(e?.message ?? '');
}

async function seguir(resposta: RespostaSignIn): Promise<ResultadoEtapa> {
  atual = resposta;
  if (resposta.status === 'complete' && resposta.createdSessionId) {
    return { tipo: 'concluido', sessionId: resposta.createdSessionId };
  }
  // Clerk pede confirmação por e-mail em aparelho novo ("client trust") ou com segundo fator ligado.
  // (os tipos desta versão do clerk-js não listam esses dois status, mas a API os devolve)
  const status = resposta.status as string | null;
  if (status === 'needs_second_factor' || status === 'needs_client_trust') {
    await resposta.prepareSecondFactor({ strategy: 'email_code' });
    return { tipo: 'codigo' };
  }
  throw new ErroLogin('Não foi possível concluir o acesso. Use "Esqueci minha senha" ou fale com o administrador.');
}

async function novoSignIn(clerk: ClerkInstance): Promise<SignIn> {
  // Uma sessão anterior que ficou aberta (ex.: acesso recusado) impede um novo login ("session_exists").
  if (clerk.session) await clerk.signOut();
  if (!clerk.client) throw new ErroLogin('Não foi possível iniciar o login. Tente novamente.');
  return clerk.client.signIn;
}

export async function entrarComSenha(email: string, senha: string): Promise<ResultadoEtapa> {
  const clerk = await clerkOnline();
  const signIn = await novoSignIn(clerk);
  return seguir(await signIn.create({ identifier: email.trim().toLowerCase(), password: senha }));
}

export async function confirmarCodigo(codigo: string): Promise<ResultadoEtapa> {
  if (!atual) throw new ErroLogin('O código expirou. Comece o acesso novamente.');
  return seguir(await atual.attemptSecondFactor({ strategy: 'email_code', code: codigo.trim() }));
}

export async function pedirCodigoRedefinicao(email: string): Promise<void> {
  const clerk = await clerkOnline();
  const signIn = await novoSignIn(clerk);
  atual = await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim().toLowerCase() });
}

export async function redefinirSenha(codigo: string, novaSenha: string): Promise<ResultadoEtapa> {
  if (!atual) throw new ErroLogin('O código expirou. Peça um novo código.');
  return seguir(await atual.attemptFirstFactor({
    strategy: 'reset_password_email_code',
    code: codigo.trim(),
    password: novaSenha,
  }));
}

export function mensagemDoErro(err: unknown): string {
  if (err instanceof ErroLogin) return err.message;
  if (isClerkAPIResponseError(err)) {
    const code = err.errors[0]?.code ?? '';
    if (['form_password_incorrect', 'form_identifier_not_found', 'strategy_for_user_invalid'].includes(code)) {
      return 'E-mail ou senha inválidos.';
    }
    if (code === 'form_code_incorrect' || code === 'verification_failed' || code === 'verification_expired') {
      return 'Código inválido ou expirado.';
    }
    if (code === 'form_password_pwned') return 'Esta senha apareceu em vazamentos conhecidos. Escolha outra.';
    if (code === 'form_password_length_too_short' || code === 'form_password_not_strong_enough') {
      return 'A nova senha não atende à política de segurança.';
    }
    if (code === 'form_password_validation_failed') return 'A senha atual está incorreta.';
    if (code === 'too_many_requests') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (code === 'user_locked') return 'Conta temporariamente bloqueada por excesso de tentativas.';
  }
  if (bancoLocalEmUso(err)) return MSG_BANCO_EM_USO;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sem conexão. Conecte-se à internet e tente novamente.';
  }
  // Erro inesperado: fica no console para diagnóstico (a tela mostra só a mensagem genérica).
  console.error('[login] erro inesperado', err);
  return 'Não foi possível concluir a operação. Tente novamente.';
}
