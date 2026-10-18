'use server';

import { revalidatePath } from 'next/cache';
import { clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { minimumPasswordSchema } from '@/lib/auth/passwords';
import { requireTenantRole } from '@/lib/auth/context';

type UsuarioInput = {
  nome: string;
  email: string;
  senha?: string;
  cargo?: string;
  perfil: 'admin' | 'gestor' | 'inspetor';
  obras?: string[];
};

function splitNome(nome: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = nome.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') || undefined };
}

// Mensagens do Clerk vêm em inglês e em formato técnico; devolve a 1ª legível.
function clerkMessage(error: unknown, fallback: string): string {
  const errors = (error as { errors?: Array<{ code?: string; longMessage?: string; message?: string }> })?.errors;
  const first = errors?.[0];
  if (first?.code === 'form_identifier_exists') return 'Já existe uma conta com este e-mail.';
  if (first?.code === 'form_password_pwned') return 'Esta senha apareceu em vazamentos conhecidos. Escolha outra.';
  if (first?.code === 'form_password_length_too_short') {
    // o mínimo é configurado no Clerk; repassa o número que ele exige em vez de fixar um aqui
    const minimo = (first.message ?? '').match(/\d+/)?.[0];
    return minimo ? `A senha deve ter pelo menos ${minimo} caracteres.` : 'A senha é curta demais.';
  }
  return first?.longMessage ?? first?.message ?? (error instanceof Error ? error.message : fallback);
}

async function validateObras(clienteId: string, obraIds: string[]): Promise<void> {
  if (!obraIds.length) return;
  const supabase = await createClient();
  const { data, error } = await supabase.from('obras').select('id').eq('cliente_id', clienteId).in('id', obraIds);
  if (error || data?.length !== new Set(obraIds).size) throw new Error('Uma ou mais obras estão fora do cliente.');
}

async function replaceObras(usuarioId: string, clienteId: string, perfil: UsuarioInput['perfil'], obraIds: string[]) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase.from('obra_usuarios').delete().eq('usuario_id', usuarioId).eq('cliente_id', clienteId);
  if (deleteError) throw deleteError;
  if (perfil !== 'admin' && obraIds.length) {
    const { error } = await supabase.from('obra_usuarios').insert(obraIds.map(obra_id => ({
      cliente_id: clienteId,
      usuario_id: usuarioId,
      obra_id,
      papel: perfil,
      ativo: true,
    })));
    if (error) throw error;
  }
}

export async function createUsuario(data: UsuarioInput) {
  let clerkUserId: string | null = null;
  try {
    const context = await requireTenantRole(['admin']);
    const password = minimumPasswordSchema.parse(data.senha);
    const obraIds = data.perfil === 'admin' ? [] : Array.from(new Set(data.obras ?? []));
    await validateObras(context.clienteId, obraIds);

    const email = data.email.trim().toLowerCase();
    const clerk = await clerkClient();
    const created = await clerk.users.createUser({
      emailAddress: [email],
      password,
      ...splitNome(data.nome),
    });
    clerkUserId = created.id;

    // usuário + vínculos de obra numa transação só (função do banco, com a RLS do admin)
    const supabase = await createClient();
    const { error } = await supabase.rpc('criar_usuario', {
      p_clerk_user_id: created.id,
      p_email: email,
      p_nome: data.nome.trim(),
      p_cargo: data.cargo?.trim() ?? '',
      p_perfil: data.perfil,
      p_obras: obraIds,
    });
    if (error) throw error;
    revalidatePath('/usuarios');
    return { success: true };
  } catch (error) {
    if (clerkUserId) {
      try {
        await (await clerkClient()).users.deleteUser(clerkUserId);
      } catch {
        // a conta órfã no Clerk não dá acesso: sem linha em `usuarios`, a RLS não libera nenhum dado
      }
    }
    return { success: false, error: clerkMessage(error, 'Falha ao criar usuário.') };
  }
}

// O Clerk não oferece, na API de backend, o envio de um e-mail de redefinição disparado por terceiros: quem
// redefine é o próprio usuário, em "Esqueci minha senha" na tela de login (código por e-mail).
export async function sendPasswordRecovery(usuarioId: string) {
  try {
    const context = await requireTenantRole(['admin']);
    const supabase = await createClient();
    const { data: target } = await supabase.from('usuarios').select('id, ativo').eq('id', usuarioId).eq('cliente_id', context.clienteId).maybeSingle();
    if (!target?.ativo) throw new Error('Usuário ativo não encontrado neste cliente.');
    return {
      success: false,
      error: 'Peça ao usuário para usar "Esqueci minha senha" na tela de login: ele receberá um código por e-mail.',
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao enviar recuperação.' };
  }
}

export async function updateUsuario(id: string, data: UsuarioInput) {
  try {
    const context = await requireTenantRole(['admin']);
    const obraIds = data.perfil === 'admin' ? [] : Array.from(new Set(data.obras ?? []));
    await validateObras(context.clienteId, obraIds);
    const supabase = await createClient();
    const { data: target } = await supabase
      .from('usuarios')
      .select('id, clerk_user_id, email')
      .eq('id', id)
      .eq('cliente_id', context.clienteId)
      .maybeSingle();
    if (!target) throw new Error('Usuário fora do escopo deste cliente.');
    if (!target.clerk_user_id) throw new Error('Este usuário ainda não possui conta de acesso.');

    const email = data.email.trim().toLowerCase();
    const clerk = await clerkClient();
    await clerk.users.updateUser(target.clerk_user_id, splitNome(data.nome));
    if (email !== (target.email ?? '').toLowerCase()) {
      const current = await clerk.users.getUser(target.clerk_user_id);
      const next = await clerk.emailAddresses.createEmailAddress({
        userId: target.clerk_user_id,
        emailAddress: email,
        verified: true,
        primary: true,
      });
      for (const old of current.emailAddresses) {
        if (old.id !== next.id) await clerk.emailAddresses.deleteEmailAddress(old.id);
      }
    }

    const { error } = await supabase.from('usuarios').update({
      nome: data.nome.trim(), email, cargo: data.cargo?.trim() || null, perfil: data.perfil,
    }).eq('id', id).eq('cliente_id', context.clienteId);
    if (error) throw error;
    await replaceObras(id, context.clienteId, data.perfil, obraIds);
    revalidatePath('/usuarios');
    return { success: true };
  } catch (error) {
    return { success: false, error: clerkMessage(error, 'Falha ao atualizar usuário.') };
  }
}
