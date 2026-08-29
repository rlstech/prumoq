'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PerfilUsuario } from '@prumoq/shared';
import { BrandMark } from '@/components/ui/BrandMark';
import { createClient } from '@/lib/supabase/client';
import {
  AlertTriangle,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  HardHat,
  Landmark,
  LayoutGrid,
  LogOut,
  Menu,
  Ruler,
  ScanLine,
  Users,
  X,
} from 'lucide-react';

/**
 * Os grupos espelham o fluxo do painel: decidir (visão geral), operar na ordem em
 * que o trabalho acontece e, por último, o que se configura antes de tudo.
 * FVS padrão é biblioteca de revisões — por isso vive em Cadastros, não na operação.
 */
export const NAV_GROUPS = [
  {
    label: null,
    items: [{ href: '/dashboard', icon: LayoutGrid, title: 'Visão geral', adminOnly: false, alert: false }],
  },
  {
    label: 'Operação',
    items: [
      { href: '/obras', icon: Building2, title: 'Obras', adminOnly: false, alert: false },
      { href: '/verificacoes', icon: ScanLine, title: 'Vistorias', adminOnly: false, alert: false },
      { href: '/nc', icon: AlertTriangle, title: 'Não conformidades', adminOnly: false, alert: true },
      { href: '/medicoes', icon: Ruler, title: 'Medições', adminOnly: false, alert: false },
      { href: '/avaliacoes', icon: ClipboardCheck, title: 'Avaliações', adminOnly: false, alert: false },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { href: '/fvs-padrao', icon: ClipboardList, title: 'FVS padrão', adminOnly: false, alert: false },
      { href: '/empresas', icon: Landmark, title: 'Empresas', adminOnly: true, alert: false },
      { href: '/equipes', icon: HardHat, title: 'Equipes', adminOnly: false, alert: false },
      { href: '/usuarios', icon: Users, title: 'Pessoas', adminOnly: true, alert: false },
    ],
  },
] as const;

const COLLAPSE_KEY = 'prumoq.sidebar.collapsed';

interface UserSummary {
  nome: string;
  cargo: string | null;
  perfil: PerfilUsuario;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export default function Sidebar({ profile }: { profile: UserSummary }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ncCount, setNcCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { count } = await supabase
        .from('nao_conformidades' as never)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aberta');
      setNcCount(count ?? 0);
    }
    void loadData();
  }, []);

  // Lido só no cliente para não divergir do HTML renderizado no servidor.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* armazenamento indisponível — segue expandida */
    }
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(current => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignora quando o armazenamento está bloqueado */
      }
      return next;
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  function navigation(expanded: boolean) {
    return (
      <>
        <nav className="flex-1 overflow-y-auto px-3 py-3.5" aria-label="Navegação principal">
          {NAV_GROUPS.map((group, groupIdx) => {
            const items = group.items.filter(item => !item.adminOnly || profile.perfil === 'admin');
            if (!items.length) return null;

            return (
              <div key={group.label ?? `grupo-${groupIdx}`} className="mb-4 last:mb-0">
                {group.label && expanded ? (
                  <div className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {group.label}
                  </div>
                ) : null}
                {group.label && !expanded ? <div className="mx-2 mb-3.5 h-px bg-white/10" /> : null}

                {items.map(item => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  const showBadge = item.alert && ncCount > 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={expanded ? undefined : item.title}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative mb-0.5 flex min-h-10 items-center rounded-lg text-[13px] transition-colors ${
                        expanded ? 'gap-3 px-3' : 'justify-center px-2'
                      } ${
                        active
                          ? 'bg-accent/[0.12] font-semibold text-white'
                          : 'font-normal text-white/60 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" /> : null}
                      <span className="relative flex shrink-0">
                        <Icon size={19} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-accent' : ''} />
                        {showBadge && !expanded ? (
                          <span className="absolute -right-2 -top-1.5 min-w-[15px] rounded-full bg-nok px-[3px] text-center font-mono text-[9px] font-semibold leading-[15px] text-white">
                            {Math.min(ncCount, 99)}
                          </span>
                        ) : null}
                      </span>
                      {expanded ? <span className="min-w-0 flex-1 truncate">{item.title}</span> : null}
                      {showBadge && expanded ? (
                        <span className="min-w-5 shrink-0 rounded-full bg-nok px-1.5 py-px text-center font-mono text-[10px] font-semibold text-white">
                          {Math.min(ncCount, 99)}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          {expanded ? (
            <div className="flex items-center gap-2.5">
              <Link
                href="/conta"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 transition-colors hover:bg-white/[0.07]"
                aria-label="Abrir minha conta"
              >
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[12px] font-semibold text-txt">
                  {initials(profile.nome)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-white/90">{profile.nome}</span>
                  <span className="block truncate text-[11px] text-white/40">Minha conta</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/conta"
                title="Minha conta"
                aria-label="Abrir minha conta"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent font-mono text-[12px] font-semibold text-txt"
              >
                {initials(profile.nome)}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  function brand(expanded: boolean) {
    return (
      <div
        className={`flex h-[72px] shrink-0 items-center border-b border-white/10 ${
          expanded ? 'gap-2.5 pl-4 pr-3' : 'justify-center px-2'
        }`}
      >
        <Link href="/dashboard" aria-label="PrumoQ — Visão geral" className="flex shrink-0 items-center">
          <BrandMark size={30} />
        </Link>
        {expanded ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-[18px] tracking-[-0.01em] text-white">PrumoQ</div>
            {profile.cargo ? (
              <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em] text-white/40">{profile.cargo}</div>
            ) : null}
          </div>
        ) : null}
        {expanded ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Recolher menu"
            aria-label="Recolher menu"
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white md:flex"
          >
            <ChevronsLeft size={17} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <aside
        className="hidden h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-200 md:flex"
        style={{ width: collapsed ? '88px' : '248px' }}
      >
        {brand(!collapsed)}
        {collapsed ? (
          <div className="flex justify-center pb-0.5 pt-2.5">
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Expandir menu"
              aria-label="Expandir menu"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              <ChevronsRight size={17} />
            </button>
          </div>
        ) : null}
        {navigation(!collapsed)}
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
          <aside className="relative flex h-full w-[248px] flex-col bg-sidebar shadow-float">
            <div className="relative">
              {brand(true)}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute -right-12 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-bg-1 text-txt shadow-card"
                aria-label="Fechar menu"
              >
                <X size={19} />
              </button>
            </div>
            {navigation(true)}
          </aside>
        </div>
      ) : null}
    </>
  );
}
