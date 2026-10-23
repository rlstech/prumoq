import { QueryClient } from '@tanstack/react-query';

// Único QueryClient do painel: usado pelo provider e por revalidatePath/router.refresh (lib/compat).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Chave raiz das páginas/layouts executados pelo adaptador (lib/compat/server-component.tsx). */
export const PAGE_QUERY_KEY = 'pagina';

/** Recarrega os dados de todas as telas abertas (equivale ao revalidatePath/router.refresh do Next). */
export function refreshPages(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [PAGE_QUERY_KEY] });
}
