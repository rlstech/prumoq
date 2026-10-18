'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';

// O servidor não encerra a sessão do Clerk; a tela de login faz isso no navegador (?sair=1).
export async function logoutPlatform(): Promise<void> {
  redirect('/login?sair=1');
}

const nullableLimit = z.preprocess(
  value => value === '' || value === null || value === undefined ? null : Number(value),
  z.number({ invalid_type_error: 'Limites: use números inteiros maiores que zero (ou deixe em branco).' })
    .int('Limites: use números inteiros maiores que zero (ou deixe em branco).')
    .positive('Limites: use números inteiros maiores que zero (ou deixe em branco).')
    .nullable(),
);

// "Cliente Teste Ltda." -> "cliente-teste-ltda": aceita o que a pessoa digitar em vez de recusar com "Invalid".
const slugify = (value: unknown) => typeof value !== 'string' ? value : value
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const clientSchema = z.object({
  nome: z.string().trim().min(2, 'Nome: informe ao menos 2 caracteres.').max(120, 'Nome: máximo de 120 caracteres.'),
  slug: z.preprocess(slugify, z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug: use letras, números e hífen.')),
  contato_nome: z.string().trim().max(120, 'Contato: máximo de 120 caracteres.').optional(),
  contato_email: z.string().trim().email('E-mail do administrador inválido.'),
  contato_telefone: z.string().trim().max(30, 'Telefone: máximo de 30 caracteres.').optional(),
  limite_usuarios: nullableLimit,
  limite_empresas: nullableLimit,
  limite_obras: nullableLimit,
});

export type ClientActionResult = { success: true } | { success: false; error: string };

function clerkMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return issue?.message && issue.message !== 'Invalid' ? issue.message : `Campo inválido: ${issue?.path.join('.') || 'formulário'}.`;
  }
  const first = (error as { errors?: Array<{ code?: string; longMessage?: string; message?: string }> })?.errors?.[0];
  if (first?.code === 'form_identifier_exists') return 'Já existe uma conta com o e-mail do administrador.';
  return first?.longMessage ?? first?.message ?? (error instanceof Error ? error.message : fallback);
}

export async function createCliente(input: unknown): Promise<ClientActionResult> {
  let clerkUserId: string | null = null;
  try {
    await requirePlatformAdmin();
    const parsed = clientSchema.parse(input);
    const nomeAdmin = (parsed.contato_nome || parsed.nome).trim();
    const [firstName, ...rest] = nomeAdmin.split(/\s+/);

    // 1) conta do administrador inicial no Clerk, sem senha: ele a define em "Esqueci minha senha" na tela de login
    const clerk = await clerkClient();
    const created = await clerk.users.createUser({
      emailAddress: [parsed.contato_email.toLowerCase()],
      firstName,
      lastName: rest.join(' ') || undefined,
      skipPasswordRequirement: true,
    });
    clerkUserId = created.id;

    // 2) cliente + administrador + auditoria numa transação só (função do banco; exige superadmin)
    const supabase = await createClient();
    const { error } = await supabase.rpc('plataforma_criar_cliente', {
      p_nome: parsed.nome,
      p_slug: parsed.slug,
      p_contato_nome: parsed.contato_nome ?? '',
      p_contato_email: parsed.contato_email,
      p_contato_telefone: parsed.contato_telefone ?? '',
      p_limite_usuarios: parsed.limite_usuarios,
      p_limite_empresas: parsed.limite_empresas,
      p_limite_obras: parsed.limite_obras,
      p_admin_clerk_id: created.id,
    });
    if (error) throw error;
    revalidatePath('/clientes');
    return { success: true };
  } catch (error) {
    if (clerkUserId) {
      try {
        await (await clerkClient()).users.deleteUser(clerkUserId);
      } catch {
        // conta órfã no Clerk não dá acesso a dados: sem linha em `usuarios`, a RLS não libera nada
      }
    }
    return { success: false, error: clerkMessage(error, 'Falha ao criar cliente.') };
  }
}

const updateSchema = clientSchema.omit({ contato_email: true }).extend({
  id: z.string().uuid(),
  status: z.enum(['ativo', 'suspenso']),
  contato_email: z.string().trim().email().optional(),
});

export async function updateCliente(input: unknown): Promise<ClientActionResult> {
  try {
    await requirePlatformAdmin();
    const parsed = updateSchema.parse(input);
    const { id, ...changes } = parsed;
    const supabase = await createClient();
    const { error } = await supabase.rpc('plataforma_atualizar_cliente', {
      p_id: id,
      p_nome: changes.nome,
      p_slug: changes.slug,
      p_contato_nome: changes.contato_nome ?? '',
      p_contato_email: changes.contato_email ?? '',
      p_contato_telefone: changes.contato_telefone ?? '',
      p_limite_usuarios: changes.limite_usuarios,
      p_limite_empresas: changes.limite_empresas,
      p_limite_obras: changes.limite_obras,
      p_status: changes.status,
      p_detalhes: changes,
    });
    if (error) throw error;
    revalidatePath('/clientes');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao atualizar cliente.' };
  }
}
