/**
 * Navegação do modo "item a item" da verificação.
 *
 * Funções puras sobre a ordem dos itens da tela (`sortedItens`): o modo foco
 * só percorre itens editáveis — na reinspeção, os itens travados ("mantidos")
 * ficam de fora — e nunca guarda nada no rascunho.
 */

export interface FocusItems {
  /** Ids na ordem em que a tela mostra os itens. */
  order: readonly string[];
  /** Itens que não podem ser respondidos agora (reinspeção). */
  locked?: ReadonlySet<string>;
}

function editable({ order, locked }: FocusItems): string[] {
  return locked && locked.size > 0 ? order.filter(id => !locked.has(id)) : [...order];
}

/** Primeiro item editável sem resposta; se todos têm, o primeiro editável. */
export function initialFocusId(
  items: FocusItems,
  itemResults: Readonly<Record<string, string | undefined>>,
): string | null {
  const list = editable(items);
  return list.find(id => !itemResults[id]) ?? list[0] ?? null;
}

/** Próximo item editável depois do atual, ou null no último. */
export function nextFocusId(items: FocusItems, currentId: string | null): string | null {
  const list = editable(items);
  if (list.length === 0) return null;
  if (!currentId) return list[0];
  const index = list.indexOf(currentId);
  if (index < 0) return list[0];
  return list[index + 1] ?? null;
}

/** Item editável anterior ao atual, ou null no primeiro. */
export function previousFocusId(items: FocusItems, currentId: string | null): string | null {
  const list = editable(items);
  if (!currentId) return null;
  const index = list.indexOf(currentId);
  if (index <= 0) return null;
  return list[index - 1];
}

/** Posição (base 1) do item entre os editáveis e o total de editáveis. */
export function focusPosition(items: FocusItems, currentId: string | null): { position: number; total: number } {
  const list = editable(items);
  const index = currentId ? list.indexOf(currentId) : -1;
  return { position: index < 0 ? 0 : index + 1, total: list.length };
}

const ITEM_ERROR = /^(?:item|nc_desc|nc_foto|nc_sol|nc_data|nc_resp|nc_fin)_(.+)$/;

/** Primeiro item, na ordem da tela, que tem erro de validação próprio ou da NC. */
export function firstErrorItemId(
  order: readonly string[],
  errors: Readonly<Record<string, string | undefined>>,
): string | null {
  const withError = new Set<string>();
  for (const [key, message] of Object.entries(errors)) {
    if (!message) continue;
    const match = ITEM_ERROR.exec(key);
    if (match) withError.add(match[1]);
  }
  return order.find(id => withError.has(id)) ?? null;
}
