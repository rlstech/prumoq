import { redirect } from '@/lib/compat/navigation';
import { requirePlatformAdmin } from '@/lib/auth/context';
import { BrandMark, BrandWordmark } from '@/components/ui/BrandMark';
import { LogOut } from '@/components/icons';
import { logoutPlatform } from './clientes/actions';


export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  try {
    const context = await requirePlatformAdmin();
    return (
      <div className="min-h-screen bg-bg-0">
        <header className="on-brand m-3 flex h-[72px] items-center justify-between rounded-[28px] bg-sidebar px-5 text-white">
          <div className="flex items-center gap-2.5">
            <BrandMark size={34} />
            <BrandWordmark />
            <span className="ml-1 rounded-full bg-[#26292D] px-3 py-1 text-xs font-semibold text-on-brand">Plataforma</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-on-brand">
            <span className="hidden sm:inline">{context.nome}</span>
            <form action={logoutPlatform}>
              <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 font-semibold transition-colors hover:bg-white/[0.08] hover:text-white">
                <LogOut size={17} /> Sair
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
