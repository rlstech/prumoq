import { z } from 'zod';

// A última conta que entrou neste aparelho. É o que permite abrir o app sem internet: o Clerk só
// confirma a sessão online, e o id do Clerk não é sincronizado pelo PowerSync (usuarios.clerk_user_id
// fica só no servidor). Contém apenas dados de identificação, nada de token.
const CHAVE = 'prumoq:conta-local';
const CHAVE_SAIDA_PENDENTE = 'prumoq:saida-pendente';

const contaSchema = z.object({
  clerkUserId: z.string().min(1),
  usuarioId: z.string().uuid(),
  clienteId: z.string().uuid(),
  perfil: z.enum(['inspetor', 'admin', 'gestor']),
  nome: z.string(),
  email: z.string().nullable(),
  salvaEm: z.string(),
});

export type ContaLocal = z.infer<typeof contaSchema>;
export type PerfilApp = ContaLocal['perfil'];

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function lerContaLocal(): ContaLocal | null {
  try {
    const bruto = storage()?.getItem(CHAVE);
    if (!bruto) return null;
    const resultado = contaSchema.safeParse(JSON.parse(bruto));
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

export function salvarContaLocal(conta: ContaLocal): void {
  try {
    storage()?.setItem(CHAVE, JSON.stringify(conta));
  } catch {
    // sem armazenamento: o app funciona online, mas não abrirá offline
  }
}

export function apagarContaLocal(): void {
  try {
    storage()?.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}

// Saída feita sem internet: a sessão do Clerk continua válida no servidor e precisa ser encerrada assim
// que o Clerk carregar de novo (senão o próximo boot entraria sozinho com a conta anterior).
export function marcarSaidaPendente(): void {
  try {
    storage()?.setItem(CHAVE_SAIDA_PENDENTE, '1');
  } catch {
    // nada a fazer
  }
}

export function consumirSaidaPendente(): boolean {
  try {
    const pendente = storage()?.getItem(CHAVE_SAIDA_PENDENTE) === '1';
    if (pendente) storage()?.removeItem(CHAVE_SAIDA_PENDENTE);
    return pendente;
  } catch {
    return false;
  }
}
