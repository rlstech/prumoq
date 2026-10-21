// Executa no navegador as páginas e layouts que no Next eram Server Components assíncronos: a função busca os
// dados (com o token do usuário) e devolve JSX. Aqui ela roda dentro de uma consulta do TanStack Query, então
// revalidatePath/router.refresh recarregam a tela, e redirect()/notFound() viram navegação.
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation, useParams } from 'react-router';
import { NotFoundSignal, RedirectSignal } from './navigation';
import { PAGE_QUERY_KEY } from './query-client';

export type ServerComponentProps = {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
  children?: ReactNode;
};

// As páginas do Next tipam params/searchParams cada uma do seu jeito: aceita qualquer função assíncrona de props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServerComponent = (props: any) => ReactNode | Promise<ReactNode>;

type Resultado = { node: ReactNode } | { redirect: string } | { notFound: true };

type Props = {
  /** Identifica a tela na chave do cache. */
  id: string;
  component: ServerComponent;
  /** Layout: não recarrega a cada troca de página (a chave não inclui o caminho) e renderiza <Outlet/> como children. */
  layout?: boolean;
  /** Mostrado enquanto a primeira carga não termina. */
  fallback?: ReactNode;
};

export function ServerComponentRoute({ id, component, layout = false, fallback = null }: Props) {
  const params = useParams() as Record<string, string>;
  const location = useLocation();
  // Os layouts do painel não usam params; com o caminho na chave, a barra lateral piscaria a cada navegação.
  const queryKey = layout
    ? [PAGE_QUERY_KEY, id]
    : [PAGE_QUERY_KEY, id, location.pathname, location.search];

  const query = useQuery<Resultado>({
    queryKey,
    queryFn: async () => {
      try {
        const searchParams = Object.fromEntries(new URLSearchParams(location.search));
        const node = await component({
          params: Promise.resolve(params),
          searchParams: Promise.resolve(searchParams),
          children: layout ? <Outlet /> : undefined,
        });
        return { node };
      } catch (error) {
        if (error instanceof RedirectSignal) return { redirect: error.to };
        if (error instanceof NotFoundSignal) return { notFound: true };
        throw error;
      }
    },
    // O resultado é JSX: sem comparação estrutural (percorreria a árvore do React) e sem novas tentativas cegas.
    structuralSharing: false,
    staleTime: 0,
    retry: false,
  });

  if (query.isPending) return <>{fallback}</>;
  if (query.isError) return <ErroDeTela error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;
  if ('redirect' in data) return <Navigate to={data.redirect} replace />;
  if ('notFound' in data) return <NaoEncontrado />;
  return <>{data.node}</>;
}

function ErroDeTela({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="prumo-page">
      <div className="prumo-page-inner">
        <div className="prumo-panel space-y-3 p-6">
          <h1 className="text-base font-semibold text-txt">Não foi possível carregar esta tela</h1>
          <p className="text-sm text-txt-2">{error.message || 'Erro inesperado.'}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  );
}

export function NaoEncontrado() {
  return (
    <div className="prumo-page">
      <div className="prumo-page-inner">
        <div className="prumo-panel p-6">
          <h1 className="text-base font-semibold text-txt">Página não encontrada</h1>
          <p className="mt-1 text-sm text-txt-2">O endereço não existe ou você não tem acesso a ele.</p>
        </div>
      </div>
    </div>
  );
}
