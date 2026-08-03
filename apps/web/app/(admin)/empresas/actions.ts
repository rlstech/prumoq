'use server';

import { createClient } from '@/lib/supabase/server';
import { requireTenantRole } from '@/lib/auth/context';
import { revalidatePath } from 'next/cache';

export async function createEmpresa(data: {
  nome: string;
  cnpj: string;
  ie?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  contato?: string;
  email?: string;
  telefone?: string;
}) {
  try {
    const context = await requireTenantRole(['admin']);
    const supabase = await createClient();
    const payload: Record<string, any> = {
      nome: data.nome.trim(),
      cnpj: data.cnpj.replace(/\D/g, ''),
      ativo: true,
      cliente_id: context.clienteId,
    };
    if (data.ie) payload.ie = data.ie.trim();
    if (data.endereco) payload.endereco = data.endereco.trim();
    if (data.municipio) payload.municipio = data.municipio.trim();
    if (data.uf) payload.uf = data.uf.trim().toUpperCase();
    if (data.cep) payload.cep = data.cep.trim();
    if (data.contato) payload.contato = data.contato.trim();
    if (data.email) payload.email = data.email.trim();
    if (data.telefone) payload.telefone = data.telefone.trim();

    const { error } = await supabase.from('empresas').insert(payload as never);
    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return { success: false, error: 'CNPJ já cadastrado.' };
      }
      throw error;
    }
    revalidatePath('/empresas');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateEmpresa(id: string, data: {
  nome?: string;
  cnpj?: string;
  ie?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  contato?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
}) {
  try {
    const context = await requireTenantRole(['admin']);
    const supabase = await createClient();
    const payload: Record<string, any> = {};
    if (data.nome !== undefined) payload.nome = data.nome.trim();
    if (data.cnpj !== undefined) payload.cnpj = data.cnpj.replace(/\D/g, '');
    if (data.ie !== undefined) payload.ie = data.ie.trim() || null;
    if (data.endereco !== undefined) payload.endereco = data.endereco.trim() || null;
    if (data.municipio !== undefined) payload.municipio = data.municipio.trim() || null;
    if (data.uf !== undefined) payload.uf = data.uf.trim().toUpperCase() || null;
    if (data.cep !== undefined) payload.cep = data.cep.trim() || null;
    if (data.contato !== undefined) payload.contato = data.contato.trim() || null;
    if (data.email !== undefined) payload.email = data.email.trim() || null;
    if (data.telefone !== undefined) payload.telefone = data.telefone.trim() || null;
    if (data.ativo !== undefined) payload.ativo = data.ativo;

    const { error } = await supabase.from('empresas').update(payload as never).eq('id', id).eq('cliente_id', context.clienteId);
    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return { success: false, error: 'CNPJ já cadastrado.' };
      }
      throw error;
    }
    revalidatePath('/empresas');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
