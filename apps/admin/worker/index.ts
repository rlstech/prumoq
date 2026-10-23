// Worker do painel admin: serve os arquivos estáticos (dist/) e só roda código em /admin/api/*, para o que
// exige segredo (CLERK_SECRET_KEY): criar/editar contas no Clerk. Todo o resto o painel faz direto na API REST
// do Supabase, com o token do próprio usuário e a RLS do banco.
//
// Identidade de quem chama: o token `neon` do Clerk é repassado à Data API (`rpc/current_usuario_id` + perfil em
// `usuarios`), o mesmo esquema do Worker do PWA (apps/mobile/worker/index.ts). As funções do banco chamadas aqui
// (`criar_usuario`, `plataforma_criar_cliente`) também rodam com esse token e repetem as checagens de perfil.
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { z } from 'zod';
import { minimumPasswordSchema } from '../src/lib/auth/passwords';

export interface Env {
  ASSETS?: Fetcher;
  /** URL do projeto Supabase (ex.: https://xxxx.supabase.co). */
  SUPABASE_URL: string;
  /** Chave publicável do Supabase (header apikey). */
  SUPABASE_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Resultado = { success: true } | { success: false; error: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** API REST do Supabase com o token do usuário. Repete o 401 `jwt_ausente` (herança do Neon; inofensivo). */
async function dataApi<T>(env: Env, token: string, path: string, init?: RequestInit): Promise<T> {
  const base = env.SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    if (response.ok) return (text ? JSON.parse(text) : null) as T;
    if (response.status === 401 && text.includes('jwt_ausente') && attempt < 8) {
      await new Promise(resolve => setTimeout(resolve, Math.min(150 * 2 ** attempt, 2000)));
      continue;
    }
    if (response.status === 401 || (path.startsWith('rpc/current_usuario_id') && (response.status === 400 || response.status === 403))) {
      throw new HttpError(401, 'Sessão expirada. Entre novamente.');
    }
    // Erro de função do banco (ex.: limite do plano, e-mail repetido): repassa a mensagem do PostgREST.
    let message = `Data API ${response.status}`;
    try { message = (JSON.parse(text) as { message?: string }).message ?? message; } catch { /* texto puro */ }
    throw new HttpError(response.status >= 500 ? 502 : 400, message);
  }
}

const rpc = <T>(env: Env, token: string, fn: string, args: Record<string, unknown>) =>
  dataApi<T>(env, token, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

type Chamador = { usuarioId: string; perfil: string; clienteId: string | null };

async function chamador(env: Env, token: string): Promise<Chamador> {
  const usuarioId = await rpc<string | null>(env, token, 'current_usuario_id', {});
  if (!usuarioId) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  const [perfil] = await dataApi<Array<{ perfil: string; ativo: boolean; cliente_id: string | null }>>(
    env, token, `usuarios?select=perfil,ativo,cliente_id&id=eq.${encodeURIComponent(usuarioId)}`,
  );
  if (!perfil?.ativo) throw new HttpError(403, 'Usuário inativo.');
  return { usuarioId, perfil: perfil.perfil, clienteId: perfil.cliente_id };
}

async function adminDeClienteAtivo(env: Env, token: string): Promise<Chamador & { clienteId: string }> {
  const quem = await chamador(env, token);
  if (quem.perfil !== 'admin' || !quem.clienteId) throw new HttpError(403, 'Sem permissão para realizar esta operação.');
  const [cliente] = await dataApi<Array<{ status: string }>>(env, token, `clientes?select=status&id=eq.${quem.clienteId}`);
  if (cliente?.status !== 'ativo') throw new HttpError(403, 'Ambiente suspenso.');
  return quem as Chamador & { clienteId: string };
}

function splitNome(nome: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = nome.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') || undefined };
}

// Mensagens do Clerk vêm em inglês e em formato técnico; devolve a 1ª legível.
function mensagem(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return issue?.message && issue.message !== 'Invalid' ? issue.message : `Campo inválido: ${issue?.path.join('.') || 'formulário'}.`;
  }
  if (error instanceof HttpError) return error.message;
  const first = (error as { errors?: Array<{ code?: string; longMessage?: string; message?: string }> })?.errors?.[0];
  if (first?.code === 'form_identifier_exists') return 'Já existe uma conta com este e-mail.';
  if (first?.code === 'form_password_pwned') return 'Esta senha apareceu em vazamentos conhecidos. Escolha outra.';
  if (first?.code === 'form_password_length_too_short') {
    const minimo = (first.message ?? '').match(/\d+/)?.[0];
    return minimo ? `A senha deve ter pelo menos ${minimo} caracteres.` : 'A senha é curta demais.';
  }
  return first?.longMessage ?? first?.message ?? (error instanceof Error ? error.message : fallback);
}

async function desfazerConta(clerk: ClerkClient, clerkUserId: string | null) {
  if (!clerkUserId) return;
  try {
    await clerk.users.deleteUser(clerkUserId);
  } catch {
    // conta órfã no Clerk não dá acesso a dados: sem linha em `usuarios`, a RLS não libera nada
  }
}

// ── Usuários ────────────────────────────────────────────────────────────────────────────────────────
const novoUsuarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome: informe ao menos 2 caracteres.'),
  email: z.string().trim().email('E-mail inválido.'),
  senha: minimumPasswordSchema,
  cargo: z.string().trim().optional(),
  perfil: z.enum(['admin', 'gestor', 'inspetor']),
  obras: z.array(z.string().uuid()).optional(),
});

async function criarUsuario(env: Env, token: string, body: unknown): Promise<Resultado> {
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  let clerkUserId: string | null = null;
  try {
    await adminDeClienteAtivo(env, token);
    const data = novoUsuarioSchema.parse(body);
    const email = data.email.toLowerCase();
    const created = await clerk.users.createUser({ emailAddress: [email], password: data.senha, ...splitNome(data.nome) });
    clerkUserId = created.id;
    // usuário + vínculos de obra numa transação só (função do banco, com a RLS do admin)
    await rpc(env, token, 'criar_usuario', {
      p_clerk_user_id: created.id,
      p_email: email,
      p_nome: data.nome,
      p_cargo: data.cargo ?? '',
      p_perfil: data.perfil,
      p_obras: data.perfil === 'admin' ? [] : Array.from(new Set(data.obras ?? [])),
    });
    return { success: true };
  } catch (error) {
    await desfazerConta(clerk, clerkUserId);
    return { success: false, error: mensagem(error, 'Falha ao criar usuário.') };
  }
}

const contaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome: informe ao menos 2 caracteres.'),
  email: z.string().trim().email('E-mail inválido.'),
});

/** Nome e e-mail da conta no Clerk. Perfil, cargo e obras o painel grava direto no banco (RLS). */
async function atualizarConta(env: Env, token: string, usuarioId: string, body: unknown): Promise<Resultado> {
  try {
    const quem = await adminDeClienteAtivo(env, token);
    const data = contaSchema.parse(body);
    // a RLS só mostra usuários do mesmo cliente; o filtro explícito deixa a regra clara
    const [alvo] = await dataApi<Array<{ clerk_user_id: string | null; email: string | null }>>(
      env, token,
      `usuarios?select=clerk_user_id,email&id=eq.${encodeURIComponent(usuarioId)}&cliente_id=eq.${quem.clienteId}`,
    );
    if (!alvo) throw new HttpError(404, 'Usuário fora do escopo deste cliente.');
    if (!alvo.clerk_user_id) throw new HttpError(400, 'Este usuário ainda não possui conta de acesso.');

    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    await clerk.users.updateUser(alvo.clerk_user_id, splitNome(data.nome));
    const email = data.email.toLowerCase();
    if (email !== (alvo.email ?? '').toLowerCase()) {
      const atual = await clerk.users.getUser(alvo.clerk_user_id);
      const novo = await clerk.emailAddresses.createEmailAddress({
        userId: alvo.clerk_user_id, emailAddress: email, verified: true, primary: true,
      });
      for (const antigo of atual.emailAddresses) {
        if (antigo.id !== novo.id) await clerk.emailAddresses.deleteEmailAddress(antigo.id);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: mensagem(error, 'Falha ao atualizar a conta.') };
  }
}

// ── Clientes (superadmin) ───────────────────────────────────────────────────────────────────────────
const novoClienteSchema = z.object({
  nome: z.string().trim().min(2),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  contato_nome: z.string().trim().optional(),
  contato_email: z.string().trim().email('E-mail do administrador inválido.'),
  contato_telefone: z.string().trim().optional(),
  limite_usuarios: z.number().int().positive().nullable(),
  limite_empresas: z.number().int().positive().nullable(),
  limite_obras: z.number().int().positive().nullable(),
});

async function criarCliente(env: Env, token: string, body: unknown): Promise<Resultado> {
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  let clerkUserId: string | null = null;
  try {
    const quem = await chamador(env, token);
    if (quem.perfil !== 'superadmin') throw new HttpError(403, 'Acesso restrito à administração da plataforma.');
    const data = novoClienteSchema.parse(body);
    // conta do administrador inicial, sem senha: ele a define em "Esqueci minha senha" na tela de login
    const created = await clerk.users.createUser({
      emailAddress: [data.contato_email.toLowerCase()],
      ...splitNome(data.contato_nome || data.nome),
      skipPasswordRequirement: true,
    });
    clerkUserId = created.id;
    // cliente + administrador + auditoria numa transação só (função do banco; exige superadmin)
    await rpc(env, token, 'plataforma_criar_cliente', {
      p_nome: data.nome,
      p_slug: data.slug,
      p_contato_nome: data.contato_nome ?? '',
      p_contato_email: data.contato_email,
      p_contato_telefone: data.contato_telefone ?? '',
      p_limite_usuarios: data.limite_usuarios,
      p_limite_empresas: data.limite_empresas,
      p_limite_obras: data.limite_obras,
      p_admin_clerk_id: created.id,
    });
    return { success: true };
  } catch (error) {
    await desfazerConta(clerk, clerkUserId);
    const msg = mensagem(error, 'Falha ao criar cliente.');
    return { success: false, error: msg === 'Já existe uma conta com este e-mail.' ? 'Já existe uma conta com o e-mail do administrador.' : msg };
  }
}

// ── Roteamento ──────────────────────────────────────────────────────────────────────────────────────
async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ success: false, error: 'Sessão expirada. Entre novamente.' }, 401);
  let body: unknown = null;
  if (request.method !== 'GET') {
    try { body = await request.json(); } catch { return json({ success: false, error: 'JSON inválido.' }, 400); }
  }
  try {
    if (path === '/admin/api/usuarios' && request.method === 'POST') return json(await criarUsuario(env, token, body));
    const conta = /^\/admin\/api\/usuarios\/([0-9a-f-]{36})\/conta$/i.exec(path);
    if (conta && request.method === 'PATCH') return json(await atualizarConta(env, token, conta[1], body));
    if (path === '/admin/api/clientes' && request.method === 'POST') return json(await criarCliente(env, token, body));
    return json({ success: false, error: 'Não encontrado.' }, 404);
  } catch (error) {
    if (error instanceof HttpError) return json({ success: false, error: error.message }, error.status);
    console.error('[admin/api]', error);
    return json({ success: false, error: 'Erro interno.' }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/admin/api/')) return handleApi(request, env, path);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
