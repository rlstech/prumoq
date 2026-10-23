import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
// Registra o envio de fotos e assinaturas usado pelo connector.
import '../media-envio';
import { db } from '../powersync';
import { PrumoqConnector, SYNC_OPTIONS, setPowerSyncTokenGetter } from '../powersync-connector';
import { signatureStore } from '../signature-store';
import { supabase } from '../supabase';
import { draftStore } from '../verification/draftStore';
import { POWERSYNC_TOKEN_TEMPLATE, carregarClerk, clerkCarregado, obterToken, type ClerkInstance } from './clerk';
import {
  apagarContaLocal,
  consumirSaidaPendente,
  lerContaLocal,
  marcarSaidaPendente,
  salvarContaLocal,
  type ContaLocal,
} from './conta-local';
import { ErroLogin, MSG_BANCO_EM_USO } from './fluxo-login';
import { buscarPerfilOnline } from './mobile-access';

// Sessão do app (offline-first):
// - Quem decide se o app abre é a conta salva no aparelho (conta-local.ts), não o Clerk. Assim o app abre
//   sem internet com a última conta que entrou.
// - O Clerk é carregado em segundo plano e, quando há internet, confirma a sessão e fornece os tokens.
// - O banco local só é apagado quando o usuário sai ou quando OUTRA pessoa entra, e nunca se houver
//   gravações ainda não enviadas ao servidor.

export type EstadoSessao =
  | { fase: 'iniciando' }
  | { fase: 'deslogado'; aviso: string | null }
  | { fase: 'ativa'; conta: ContaLocal; online: boolean }
  | { fase: 'expirada'; conta: ContaLocal; aviso: string };

export type ResultadoSaida = { ok: true } | { ok: false; pendentes: number };

interface SessaoApi {
  estado: EstadoSessao;
  /** Depois que o Clerk autentica: confere o acesso no banco e prepara os dados locais. Lança ErroLogin. */
  concluirLogin(sessionId: string): Promise<void>;
  /** Sai e apaga os dados locais. Com gravações não enviadas, só sai se `descartarPendentes`. */
  sair(opcoes?: { descartarPendentes?: boolean }): Promise<ResultadoSaida>;
}

const SessaoContext = createContext<SessaoApi | null>(null);

const AVISO_EXPIRADA =
  'Sua sessão expirou. Entre novamente para voltar a sincronizar. Os dados deste aparelho foram mantidos.';
const AVISO_PRIMEIRO_ACESSO_OFFLINE =
  'Sem conexão. O primeiro acesso neste aparelho precisa de internet.';
const RETENTATIVA_CLERK_MS = 30_000;

// O PowerSync só recebe token quando a sessão do Clerk é da mesma pessoa dona dos dados locais.
setPowerSyncTokenGetter(async () => {
  const clerk = clerkCarregado();
  const conta = lerContaLocal();
  if (!clerk?.user || !conta || clerk.user.id !== conta.clerkUserId) return null;
  return obterToken(POWERSYNC_TOKEN_TEMPLATE);
});

// Uma conexão por sessão de usuário (conectar de novo abre streams duplicados).
let conectado = false;
function conectar(): void {
  if (conectado) return;
  conectado = true;
  void db.connect(new PrumoqConnector(), SYNC_OPTIONS);
}

// A internet voltou: reconecta já, sem esperar o intervalo entre tentativas (retryDelayMs, 20 s).
// Chamar connect() de novo é seguro: o PowerSync encerra a tentativa em andamento antes de abrir outra.
function reconectarAgora(): void {
  if (!conectado || db.currentStatus.connected) return;
  void db.connect(new PrumoqConnector(), SYNC_OPTIONS);
}

// Voltou para a tela: com a tela desligada o Android congela o app e a conexão cai. Sem isto, ao voltar o
// PowerSync esperava o retryDelayMs (20 s). Depois de um tempo longe, reconecta mesmo marcado como conectado:
// a conexão pode ter morrido sem o PowerSync perceber.
const LONGE_MS = 60_000;
let escondidoDesde: number | null = null;
function aoMudarVisibilidade(): void {
  if (document.visibilityState === 'hidden') {
    escondidoDesde = Date.now();
    return;
  }
  const ficouLonge = escondidoDesde !== null && Date.now() - escondidoDesde > LONGE_MS;
  escondidoDesde = null;
  if (!conectado || (db.currentStatus.connected && !ficouLonge)) return;
  void db.connect(new PrumoqConnector(), SYNC_OPTIONS);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', aoMudarVisibilidade);

async function contarPendentes(): Promise<number> {
  try {
    return (await db.getUploadQueueStats()).count;
  } catch {
    return 0;
  }
}

async function limparDadosLocais(conta: ContaLocal | null): Promise<void> {
  if (conta) {
    try { await draftStore.deleteForUser(conta.usuarioId); } catch { /* não bloqueia */ }
    try { await signatureStore.clear(conta.usuarioId); } catch { /* não bloqueia */ }
  }
  conectado = false;
  await db.disconnectAndClear();
}

function emailDo(clerk: ClerkInstance): string | null {
  return clerk.user?.primaryEmailAddress?.emailAddress ?? null;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>(() => {
    const conta = lerContaLocal();
    return conta ? { fase: 'ativa', conta, online: false } : { fase: 'iniciando' };
  });
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  // Durante a saída o Clerk avisa "sem usuário"; isso não é sessão expirada.
  const saindo = useRef(false);

  // Troca de dono dos dados locais (outra pessoa entrou) e ativação da conta.
  const adotarConta = useCallback(async (clerk: ClerkInstance, nova: ContaLocal) => {
    const anterior = lerContaLocal();
    if (!anterior || anterior.usuarioId !== nova.usuarioId) {
      const pendentes = await contarPendentes();
      if (pendentes > 0 && anterior) {
        await clerk.signOut().catch(() => undefined);
        throw new ErroLogin(
          `Este aparelho tem ${plural(pendentes, 'alteração', 'alterações')} de ${anterior.nome} ainda não `
          + `enviadas. Entre com a conta ${anterior.email ?? 'anterior'} para enviá-las.`,
        );
      }
      if (pendentes === 0) {
        try {
          await limparDadosLocais(anterior);
        } catch (err) {
          // Quase sempre o banco local está aberto em outra aba/janela do PrumoQ (o OPFS só aceita um dono).
          console.error('[login] falha ao limpar o banco local', err);
          await clerk.signOut().catch(() => undefined);
          throw new ErroLogin(MSG_BANCO_EM_USO);
        }
      }
    }
    salvarContaLocal(nova);
    // Mesmo efeito do login do painel: marca o onboarding do admin como concluído (idempotente).
    if (nova.perfil === 'admin') void supabase.rpc('concluir_onboarding').then(() => undefined, () => undefined);
    conectar();
    setEstado({ fase: 'ativa', conta: nova, online: true });
  }, []);

  // Confere, com o Clerk carregado (online), se a sessão dele bate com a conta do aparelho.
  const avaliarClerk = useCallback(async (clerk: ClerkInstance) => {
    if (consumirSaidaPendente() && clerk.session) {
      await clerk.signOut().catch(() => undefined);
    }
    const conta = lerContaLocal();
    const user = clerk.user;

    if (!user) {
      setEstado(conta ? { fase: 'expirada', conta, aviso: AVISO_EXPIRADA } : { fase: 'deslogado', aviso: null });
      return;
    }

    if (conta && conta.clerkUserId === user.id) {
      setEstado({ fase: 'ativa', conta, online: true });
      // Atualiza nome/perfil e confirma que o acesso continua liberado.
      const perfil = await buscarPerfilOnline(user.id, emailDo(clerk));
      if (perfil.ok) {
        salvarContaLocal(perfil.conta);
        setEstado({ fase: 'ativa', conta: perfil.conta, online: true });
      } else if (perfil.motivo === 'acesso') {
        await clerk.signOut().catch(() => undefined);
        setEstado({ fase: 'expirada', conta, aviso: perfil.mensagem });
      }
      return;
    }

    // Sessão do Clerk sem conta local correspondente (ex.: armazenamento do navegador limpo).
    const perfil = await buscarPerfilOnline(user.id, emailDo(clerk));
    if (!perfil.ok) {
      if (perfil.motivo === 'acesso') await clerk.signOut().catch(() => undefined);
      setEstado(conta ? { fase: 'expirada', conta, aviso: perfil.mensagem } : { fase: 'deslogado', aviso: perfil.mensagem });
      return;
    }
    try {
      await adotarConta(clerk, perfil.conta);
    } catch (err) {
      const aviso = err instanceof Error ? err.message : AVISO_EXPIRADA;
      setEstado(conta ? { fase: 'expirada', conta, aviso } : { fase: 'deslogado', aviso });
    }
  }, [adotarConta]);

  // Boot: abre com a conta local (se houver) e tenta carregar o Clerk até conseguir.
  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let removerListener: (() => void) | null = null;
    let resolvido = false;

    if (estadoRef.current.fase === 'ativa') conectar();

    const tentar = async () => {
      if (resolvido) return;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        const clerk = await carregarClerk();
        if (!ativo || resolvido) return;
        resolvido = true;
        await avaliarClerk(clerk);
        removerListener = clerk.addListener(({ user }) => {
          if (saindo.current || user) return;
          const atual = estadoRef.current;
          if (atual.fase === 'ativa') setEstado({ fase: 'expirada', conta: atual.conta, aviso: AVISO_EXPIRADA });
        });
      } catch {
        if (!ativo || resolvido) return;
        if (estadoRef.current.fase === 'iniciando') {
          setEstado({ fase: 'deslogado', aviso: AVISO_PRIMEIRO_ACESSO_OFFLINE });
        }
        timer = setTimeout(() => void tentar(), RETENTATIVA_CLERK_MS);
      }
    };

    const aoVoltarInternet = () => {
      void tentar();
      reconectarAgora();
    };
    window.addEventListener('online', aoVoltarInternet);
    void tentar();

    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', aoVoltarInternet);
      removerListener?.();
    };
  }, [avaliarClerk]);

  const concluirLogin = useCallback(async (sessionId: string) => {
    const clerk = await carregarClerk();
    await clerk.setActive({ session: sessionId });
    const user = clerk.user;
    if (!user) throw new ErroLogin('Não foi possível iniciar a sessão. Tente novamente.');
    const perfil = await buscarPerfilOnline(user.id, emailDo(clerk));
    if (!perfil.ok) {
      await clerk.signOut().catch(() => undefined);
      throw new ErroLogin(perfil.mensagem);
    }
    await adotarConta(clerk, perfil.conta);
  }, [adotarConta]);

  const sair = useCallback(async (opcoes?: { descartarPendentes?: boolean }): Promise<ResultadoSaida> => {
    const pendentes = await contarPendentes();
    if (pendentes > 0 && !opcoes?.descartarPendentes) return { ok: false, pendentes };

    saindo.current = true;
    try {
      await limparDadosLocais(lerContaLocal());
      apagarContaLocal();
      const clerk = clerkCarregado();
      try {
        if (clerk?.session) await clerk.signOut();
        else if (!clerk) marcarSaidaPendente();
      } catch {
        // sem internet: a sessão do Clerk é encerrada quando ele carregar de novo
        marcarSaidaPendente();
      }
      setEstado({ fase: 'deslogado', aviso: null });
      return { ok: true };
    } finally {
      saindo.current = false;
    }
  }, []);

  const api = useMemo<SessaoApi>(() => ({ estado, concluirLogin, sair }), [estado, concluirLogin, sair]);
  return <SessaoContext.Provider value={api}>{children}</SessaoContext.Provider>;
}

export function useSessao(): SessaoApi {
  const api = useContext(SessaoContext);
  if (!api) throw new Error('useSessao precisa estar dentro de <SessaoProvider>.');
  return api;
}

/** Conta da sessão ativa (null fora dela). As telas de (app) só montam com a sessão ativa. */
export function useConta(): ContaLocal | null {
  const { estado } = useSessao();
  return estado.fase === 'ativa' ? estado.conta : null;
}
