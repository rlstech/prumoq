import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/auth/context';
import { BrandMark } from '@/components/ui/BrandMark';
import { LogOut } from 'lucide-react';
import { logoutPlatform } from './clientes/actions';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  try {
    const context = await requirePlatformAdmin();
    return (
      <div className="min-h-screen bg-bg-0">
        <header className="flex h-[72px] items-center justify-between bg-sidebar px-6 text-white">
          <div className="flex items-center gap-3"><BrandMark /><span className="font-semibold">PrumoQ Plataforma</span></div>
          <div className="flex items-center gap-4 text-sm text-white/65">
            <span>{context.nome}</span>
            <form action={logoutPlatform}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white">
                <LogOut size={15} /> Sair
              </button>
            </form>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  } catch {
    redirect('/dashboard');
  }
}
