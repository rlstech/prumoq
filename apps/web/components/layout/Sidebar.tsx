'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/ui/BrandMark';
import { createClient } from '@/lib/supabase/client';
import {
  AlertTriangle,
  BarChart2,
  Building2,
  ClipboardList,
  HardHat,
  Landmark,
  LayoutGrid,
  LogOut,
  Menu,
  ScanLine,
  Users,
  X,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', icon: LayoutGrid, title: 'Visão', group: 'Principal' },
  { href: '/obras', icon: Building2, title: 'Obras', group: 'Operação' },
  { href: '/fvs-padrao', icon: ClipboardList, title: 'FVS', group: 'Operação' },
  { href: '/verificacoes', icon: ScanLine, title: 'Vistorias', group: 'Operação' },
  { href: '/nc', icon: AlertTriangle, title: 'NC', group: 'Operação', alert: true },
  { href: '/relatorios', icon: BarChart2, title: 'Dados', group: 'Análise' },
  { href: '/empresas', icon: Landmark, title: 'Empresas', group: 'Cadastros' },
  { href: '/equipes', icon: HardHat, title: 'Equipes', group: 'Cadastros' },
  { href: '/usuarios', icon: Users, title: 'Pessoas', group: 'Cadastros' },
] as const;

interface UserSummary {
  nome: string;
  cargo: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [ncCount, setNcCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      if (authData.session?.user) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('nome, cargo')
          .eq('id', authData.session.user.id)
          .single();
        if (profile) setUser(profile as UserSummary);
      }
      const { count } = await supabase
        .from('nao_conformidades' as never)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aberta');
      setNcCount(count ?? 0);
    }
    void loadData();
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const navigation = (
    <>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegação principal">
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              aria-current={active ? 'page' : undefined}
              className={`group relative mb-1 flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-accent/10 text-white'
                  : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" /> : null}
              <span className="relative">
                <Icon size={20} strokeWidth={active ? 2.3 : 1.9} className={active ? 'text-accent' : ''} />
                {'alert' in item && item.alert && ncCount > 0 ? (
                  <span className="absolute -right-3 -top-2 min-w-4 rounded-full bg-nok px-1 text-center font-mono text-[9px] font-semibold leading-4 text-white">
                    {Math.min(ncCount, 99)}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-2 py-3">
        <div className="mb-2 flex flex-col items-center gap-1.5 px-1 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-txt">
            {initials(user?.nome ?? '')}
          </div>
          <div className="w-full truncate text-[10px] font-medium text-white/65">{user?.nome ?? 'PrumoQ'}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg text-[10px] text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside
        className="hidden h-screen shrink-0 flex-col bg-sidebar md:flex"
        style={{ width: 'var(--sb-w)' }}
      >
        <Link href="/dashboard" className="flex h-[72px] items-center justify-center border-b border-white/10" aria-label="PrumoQ — Visão geral">
          <BrandMark />
        </Link>
        {navigation}
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-lg bg-sidebar text-white shadow-float md:hidden"
        aria-label="Abrir menu"
      >
        <Menu size={21} />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(20,37,34,.58)]"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative flex h-full w-[88px] flex-col bg-sidebar shadow-float">
            <div className="relative flex h-[72px] items-center justify-center border-b border-white/10">
              <BrandMark />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute -right-12 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-bg-1 text-txt shadow-card"
                aria-label="Fechar menu"
              >
                <X size={19} />
              </button>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}
    </>
  );
}
