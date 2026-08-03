'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/auth/context';
import { getConfiguredPwaOrigin } from '@/lib/auth/passwords';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function logoutPlatform(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

const nullableLimit = z.preprocess(
  value => value === '' || value === null || value === undefined ? null : Number(value),
  z.number().int().positive().nullable(),
);

const clientSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  contato_nome: z.string().trim().max(120).optional(),
  contato_email: z.string().trim().email(),
  contato_telefone: z.string().trim().max(30).optional(),
  limite_usuarios: nullableLimit,
  limite_empresas: nullableLimit,
  limite_obras: nullableLimit,
});

export type ClientActionResult = { success: true } | { success: false; error: string };

export async function createCliente(input: unknown): Promise<ClientActionResult> {
  let authUserId: string | null = null;
  let clienteId: string | null = null;
  try {
    const actor = await requirePlatformAdmin();
    const parsed = clientSchema.parse(input);
    const admin = createAdminClient();
    const { data: cliente, error: clienteError } = await admin.from('clientes').insert({
      ...parsed,
      contato_nome: parsed.contato_nome || null,
      contato_telefone: parsed.contato_telefone || null,
    }).select('id').single();
    if (clienteError) throw clienteError;
    clienteId = cliente.id;

    const redirectTo = `${getConfiguredPwaOrigin()}/redefinir-senha`;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      parsed.contato_email,
      {
        redirectTo,
        data: {
          nome: parsed.contato_nome || parsed.nome,
          onboarding: 'cliente_admin',
        },
      },
    );
    if (inviteError || !invited.user) throw inviteError ?? new Error('Falha ao criar administrador inicial.');
    authUserId = invited.user.id;

    const { error: profileError } = await admin.from('usuarios').insert({
      id: invited.user.id,
      cliente_id: cliente.id,
      nome: parsed.contato_nome || parsed.nome,
      perfil: 'admin',
      ativo: true,
    });
    if (profileError) throw profileError;

    await admin.from('auditoria_plataforma').insert({
      ator_id: actor.userId,
      cliente_id: cliente.id,
      acao: 'cliente_criado',
      detalhes: { nome: parsed.nome, slug: parsed.slug, admin_email: parsed.contato_email },
    });
    revalidatePath('/clientes');
    return { success: true };
  } catch (error) {
    const admin = createAdminClient();
    if (authUserId) await admin.auth.admin.deleteUser(authUserId);
    if (clienteId) await admin.from('clientes').delete().eq('id', clienteId);
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao criar cliente.' };
  }
}

const updateSchema = clientSchema.omit({ contato_email: true }).extend({
  id: z.string().uuid(),
  status: z.enum(['ativo', 'suspenso']),
  contato_email: z.string().trim().email().optional(),
});

export async function updateCliente(input: unknown): Promise<ClientActionResult> {
  try {
    const actor = await requirePlatformAdmin();
    const parsed = updateSchema.parse(input);
    const { id, ...changes } = parsed;
    const admin = createAdminClient();
    const { error } = await admin.from('clientes').update({
      ...changes,
      contato_nome: changes.contato_nome || null,
      contato_email: changes.contato_email || null,
      contato_telefone: changes.contato_telefone || null,
    }).eq('id', id);
    if (error) throw error;
    await admin.from('auditoria_plataforma').insert({
      ator_id: actor.userId,
      cliente_id: id,
      acao: changes.status === 'suspenso' ? 'cliente_suspenso' : 'cliente_atualizado',
      detalhes: changes,
    });
    revalidatePath('/clientes');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao atualizar cliente.' };
  }
}
