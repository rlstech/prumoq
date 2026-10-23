// Mesma API de `next/navigation` usada pelo código do painel, implementada sobre o React Router.
// Caminhos são relativos a /admin (basename do router), como eram com o basePath do Next.
import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams as useRouterSearchParams } from 'react-router';
import { refreshPages } from './query-client';

/** Lançado por redirect(); o adaptador de páginas (server-component.tsx) navega para `to`. */
export class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
    this.name = 'RedirectSignal';
  }
}

/** Lançado por notFound(); o adaptador mostra a tela de "não encontrado". */
export class NotFoundSignal extends Error {
  constructor() {
    super('not-found');
    this.name = 'NotFoundSignal';
  }
}

export function redirect(to: string): never {
  throw new RedirectSignal(to);
}

export function notFound(): never {
  throw new NotFoundSignal();
}

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => ({
    push: (to: string) => { void navigate(to); },
    replace: (to: string) => { void navigate(to, { replace: true }); },
    back: () => { void navigate(-1); },
    refresh: () => { void refreshPages(); },
  }), [navigate]);
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  return useRouterSearchParams()[0];
}
