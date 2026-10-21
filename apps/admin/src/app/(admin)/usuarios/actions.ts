
import { revalidatePath } from '@/lib/compat/cache';
import { callAdminApi } from '@/lib/admin-api';
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

function errorMessage(error: unknown, fallback: string): string {
  const issue = (error as { issues?: Array<{ message?: string }> })?.issues?.[0];
  if (issue?.message) return issue.message;
  return error instanceof Error ? error.message : fallback;
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
  try {
    const context = await requireTenantRole(['admin']);
    const password = minimumPasswordSchema.parse(data.senha);
    const obraIds = data.perfil === 'admin' ? [] : Array.from(new Set(data.obras ?? []));
    await validateObras(context.clienteId, obraIds);
    // conta no Clerk + `criar_usuario` (com desfazer em caso de erro) acontecem no Worker: exigem o segredo do Clerk
    const result = await callAdminApi('usuarios', 'POST', {
      nome: data.nome.trim(),
      email: data.email.trim().toLowerCase(),
      senha: password,
      cargo: data.cargo?.trim() ?? '',
      perfil: data.perfil,
      obras: obraIds,
    });
    if (result.success) revalidatePath('/usuarios');
    return result;
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Falha ao criar usuário.') };
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
    // nome e e-mail da conta no Clerk (Worker); perfil, cargo e obras abaixo, direto no banco (RLS)
    const conta = await callAdminApi(`usuarios/${id}/conta`, 'PATCH', { nome: data.nome.trim(), email });
    if (!conta.success) return conta;

    const { error } = await supabase.from('usuarios').update({
      nome: data.nome.trim(), email, cargo: data.cargo?.trim() || null, perfil: data.perfil,
    }).eq('id', id).eq('cliente_id', context.clienteId);
    if (error) throw error;
    await replaceObras(id, context.clienteId, data.perfil, obraIds);
    revalidatePath('/usuarios');
    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Falha ao atualizar usuário.') };
  }
}
