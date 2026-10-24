
import Link from '@/lib/compat/link';
import { usePathname } from '@/lib/compat/navigation';
import { useClerk } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import type { PerfilUsuario } from '@prumoq/shared';
import { BrandMark, BrandWordmark } from '@/components/ui/BrandMark';
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
  Star,
  Users,
  X,
} from '@/components/icons';

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
      { href: '/verificacoes', icon: ClipboardCheck, title: 'Vistorias', adminOnly: false, alert: false },
      { href: '/nc', icon: AlertTriangle, title: 'Não conformidades', adminOnly: false, alert: true },
      { href: '/medicoes', icon: Ruler, title: 'Medições', adminOnly: false, alert: false },
      { href: '/avaliacoes', icon: Star, title: 'Avaliações', adminOnly: false, alert: false },
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
  const { signOut } = useClerk();
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
    await signOut({ redirectUrl: '/admin/login' });
  }

  function navigation(expanded: boolean) {
    return (
      <>
        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Navegação principal">
          {NAV_GROUPS.map((group, groupIdx) => {
            const items = group.items.filter(item => !item.adminOnly || profile.perfil === 'admin');
            if (!items.length) return null;

            return (
              <div key={group.label ?? `grupo-${groupIdx}`} className="mb-4 last:mb-0">
                {group.label && expanded ? (
                  <div className="px-3.5 pb-1.5 text-xs font-semibold text-[#8F959B]">{group.label}</div>
                ) : null}
                {group.label && !expanded ? <div className="mx-auto mb-3 h-px w-8 bg-brand-line" /> : null}

                <div className={`flex flex-col gap-0.5 ${expanded ? '' : 'items-center'}`}>
                  {items.map(item => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    const showBadge = item.alert && ncCount > 0;
                    const badgeTone = active ? 'bg-sidebar text-accent' : 'bg-nok text-white';

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={expanded ? undefined : item.title}
                        aria-label={expanded ? undefined : item.title}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex h-11 shrink-0 items-center rounded-full text-sm transition-colors ${
                          expanded ? 'gap-3 pl-3.5 pr-3' : 'w-11 justify-center'
                        } ${
                          active
                            ? 'bg-accent font-bold text-txt'
                            : 'font-medium text-on-brand hover:bg-white/[0.07] hover:text-white'
                        }`}
                      >
                        <Icon size={20} className="shrink-0" />
                        {expanded ? <span className="min-w-0 flex-1 truncate">{item.title}</span> : null}
                        {showBadge && expanded ? (
                          <span className={`flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-[7px] font-mono text-[11px] font-bold ${badgeTone}`}>
                            {Math.min(ncCount, 99)}
                          </span>
                        ) : null}
                        {showBadge && !expanded ? (
                          <span className={`absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold ${badgeTone}`}>
                            {Math.min(ncCount, 99)}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 p-3 pt-1">
          {expanded ? (
            <div className="flex items-center gap-2 rounded-full bg-[#26292D] p-1.5">
              <Link
                href="/conta"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full pr-2"
                aria-label="Abrir minha conta"
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-bold text-txt">
                  {initials(profile.nome)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-white">{profile.nome}</span>
                  <span className="block truncate text-xs text-on-brand">Minha conta</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-on-brand transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/conta"
                title="Minha conta"
                aria-label="Abrir minha conta"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-accent font-mono text-xs font-bold text-txt"
              >
                {initials(profile.nome)}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-on-brand transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  function brand(expanded: boolean) {
    return (
      <div className={`flex shrink-0 items-center pb-5 pt-5 ${expanded ? 'gap-2.5 pl-5 pr-3' : 'flex-col gap-3 px-2'}`}>
        <Link href="/dashboard" aria-label="PrumoQ — Visão geral" className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-full">
          <BrandMark size={34} />
          {expanded ? <BrandWordmark /> : null}
        </Link>
        {expanded ? <span className="flex-1" /> : null}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={expanded ? 'Recolher menu' : 'Expandir menu'}
          aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-brand transition-colors hover:bg-white/[0.08] hover:text-white md:flex"
        >
          {expanded ? <ChevronsLeft size={17} /> : <ChevronsRight size={17} />}
        </button>
      </div>
    );
  }

  return (
    <>
      <aside
        className="on-brand my-3 ml-3 hidden shrink-0 flex-col overflow-hidden rounded-[28px] bg-sidebar text-white transition-[width] duration-200 md:flex"
        style={{ width: collapsed ? '76px' : '240px' }}
      >
        {brand(!collapsed)}
        {profile.cargo && !collapsed ? (
          <div className="-mt-2 mb-4 truncate px-5 text-xs text-on-brand">{profile.cargo}</div>
        ) : null}
        {navigation(!collapsed)}
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="on-brand fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-sidebar text-white shadow-float md:hidden"
        aria-label="Abrir menu"
      >
        <Menu size={21} />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(28,31,34,.62)]"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="on-brand relative m-3 flex h-[calc(100%-24px)] w-[248px] flex-col rounded-[28px] bg-sidebar text-white shadow-float">
            <div className="relative">
              {brand(true)}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute -right-14 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-bg-1 text-txt"
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
