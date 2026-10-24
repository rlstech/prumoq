import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { ServerComponentRoute, NaoEncontrado, type ServerComponent } from '@/lib/compat/server-component';
import AdminLoading from '@/app/(admin)/loading';
import { RequireSignedIn } from '@/auth/RequireSignedIn';

// Cada tela é carregada sob demanda (um arquivo JS por tela). As páginas vindas do Next são funções assíncronas
// que buscam os dados e devolvem JSX; o ServerComponentRoute as executa (ver lib/compat/server-component.tsx).
type PageModule = { default: ServerComponent };

function page(id: string, load: () => Promise<PageModule>, fallback: ReactNode = <AdminLoading />) {
  const Lazy = lazy(async () => {
    const mod = await load();
    const Route: ComponentType = () => <ServerComponentRoute id={id} component={mod.default} fallback={fallback} />;
    return { default: Route };
  });
  return (
    <Suspense fallback={fallback}>
      <Lazy />
    </Suspense>
  );
}

function layout(id: string, load: () => Promise<PageModule>) {
  const fallback = <TelaCarregando />;
  const Lazy = lazy(async () => {
    const mod = await load();
    const Route: ComponentType = () => <ServerComponentRoute id={id} component={mod.default} layout fallback={fallback} />;
    return { default: Route };
  });
  return (
    <Suspense fallback={fallback}>
      <Lazy />
    </Suspense>
  );
}

function TelaCarregando() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-0" aria-busy="true" aria-label="Carregando">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brd-0 border-t-brand" />
    </div>
  );
}

export const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to="/dashboard" replace /> },
    { path: '/login', element: page('login', () => import('@/app/(auth)/login/page'), <TelaCarregando />) },
    { path: '/suspenso', element: page('suspenso', () => import('@/app/(auth)/suspenso/page'), <TelaCarregando />) },
    {
      element: <RequireSignedIn><Outlet /></RequireSignedIn>,
      children: [
        {
          element: layout('layout-admin', () => import('@/app/(admin)/layout')),
          children: [
            { path: '/dashboard', element: page('dashboard', () => import('@/app/(admin)/dashboard/page')) },
            { path: '/conta', element: page('conta', () => import('@/app/(admin)/conta/page')) },
            { path: '/avaliacoes', element: page('avaliacoes', () => import('@/app/(admin)/avaliacoes/page')) },
            { path: '/empresas', element: page('empresas', () => import('@/app/(admin)/empresas/page')) },
            { path: '/empresas/:id/modelos-medicao', element: page('modelos-medicao', () => import('@/app/(admin)/empresas/[id]/modelos-medicao/page')) },
            { path: '/equipes', element: page('equipes', () => import('@/app/(admin)/equipes/page')) },
            { path: '/fvs-padrao', element: page('fvs-padrao', () => import('@/app/(admin)/fvs-padrao/page')) },
            { path: '/fvs-padrao/:id', element: page('fvs-padrao-detalhe', () => import('@/app/(admin)/fvs-padrao/[id]/page')) },
            { path: '/medicoes', element: page('medicoes', () => import('@/app/(admin)/medicoes/page')) },
            { path: '/medicoes/contratos/:id', element: page('contrato', () => import('@/app/(admin)/medicoes/contratos/[id]/page')) },
            { path: '/medicoes/m/:medicaoId', element: page('medicao', () => import('@/app/(admin)/medicoes/m/[medicaoId]/page')) },
            { path: '/nc', element: page('nc', () => import('@/app/(admin)/nc/page')) },
            { path: '/nc/:id', element: page('nc-detalhe', () => import('@/app/(admin)/nc/[id]/page')) },
            { path: '/obras', element: page('obras', () => import('@/app/(admin)/obras/page')) },
            { path: '/obras/:id', element: page('obra', () => import('@/app/(admin)/obras/[id]/page')) },
            { path: '/obras/:id/ambiente/:ambId', element: page('ambiente', () => import('@/app/(admin)/obras/[id]/ambiente/[ambId]/page')) },
            {
              path: '/obras/:id/ambiente/:ambId/fvs/:fvsId/medicao',
              element: page('medicao-servico', () => import('@/app/(admin)/obras/[id]/ambiente/[ambId]/fvs/[fvsId]/medicao/page')),
            },
            { path: '/usuarios', element: page('usuarios', () => import('@/app/(admin)/usuarios/page')) },
            { path: '/verificacoes', element: page('verificacoes', () => import('@/app/(admin)/verificacoes/page')) },
          ],
        },
        {
          element: layout('layout-plataforma', () => import('@/app/(platform)/layout')),
          children: [
            { path: '/clientes', element: page('clientes', () => import('@/app/(platform)/clientes/page')) },
          ],
        },
        { path: '/relatorio/fvs/:fvsId', element: page('relatorio-fvs', () => import('@/app/relatorio/fvs/[fvsId]/page'), <TelaCarregando />) },
        { path: '/relatorio/medicoes', element: page('relatorio-medicoes', () => import('@/app/relatorio/medicoes/page'), <TelaCarregando />) },
        {
          path: '/relatorio/avaliacoes-empreiteiro/:id',
          element: page('relatorio-avaliacao', () => import('@/app/relatorio/avaliacoes-empreiteiro/[id]/page'), <TelaCarregando />),
        },
      ],
    },
    { path: '*', element: <NaoEncontrado /> },
  ],
  { basename: '/admin' },
);
