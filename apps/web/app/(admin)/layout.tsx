import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import QueryProvider from '@/lib/query-provider';
import { ToastProvider } from '@/components/ui/Toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log(`[AdminLayout] Redirecting to /login because no user in layout.tsx!`);
    redirect('/login');
  }

  return (
    <QueryProvider>
      <ToastProvider>
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg0)' }}>
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden bg-bg-0">
            {children}
          </main>
        </div>
      </ToastProvider>
    </QueryProvider>
  );
}
