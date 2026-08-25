// All admin pages require auth and live DB access — never pre-render at build time
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/context';
import Sidebar from '@/components/layout/Sidebar';
import QueryProvider from '@/lib/query-provider';
import { ToastProvider } from '@/components/ui/Toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthContext();

  if (!context) {
    redirect('/login');
  }
  if (context.perfil === 'superadmin') redirect('/clientes');
  if (context.perfil === 'inspetor') redirect('/login');
  if (context.clienteStatus !== 'ativo') redirect('/suspenso');

  return (
    <QueryProvider>
      <ToastProvider>
        <div className="flex h-screen overflow-hidden bg-bg-0">
          <Sidebar profile={{ nome: context.nome, cargo: context.clienteNome, perfil: context.perfil }} />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-0">
            {children}
          </main>
        </div>
      </ToastProvider>
    </QueryProvider>
  );
}
