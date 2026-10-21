import { refreshPages } from './query-client';

// Antes (Next): invalidava o cache do servidor para o caminho. Agora recarrega as consultas das telas abertas.
// O caminho é ignorado: recarregar tudo é barato (só as telas montadas buscam de novo).
export function revalidatePath(_path?: string): void {
  void refreshPages();
}
