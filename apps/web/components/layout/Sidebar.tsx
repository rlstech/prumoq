'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutGrid,
  Building2,
  ClipboardList,
  Landmark,
  HardHat,
  Users,
  ScanLine,
  AlertTriangle,
  BarChart2,
  LogOut,
} from 'lucide-react';

const NAV = [
  { label: 'PRINCIPAL', items: [
    { href: '/dashboard', icon: LayoutGrid, title: 'Dashboard' },
  ]},
  { label: 'CADASTROS', items: [
    { href: '/empresas',  icon: Landmark,     title: 'Empresas' },
    { href: '/obras',     icon: Building2,    title: 'Obras' },
    { href: '/fvs-padrao', icon: ClipboardList, title: 'FVS Padrão' },
    { href: '/equipes',   icon: HardHat,      title: 'Equipes' },
    { href: '/usuarios',  icon: Users,        title: 'Usuários' },
  ]},
  { label: 'OPERAÇÕES', items: [
    { href: '/verificacoes', icon: ScanLine,      title: 'Verificações' },
    { href: '/nc',           icon: AlertTriangle,  title: 'Não Conformidades', alert: true },
    { href: '/relatorios',   icon: BarChart2,      title: 'Relatórios' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ nome: string; cargo: string } | null>(null);
  const [ncCount, setNcCount] = useState(0);

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
        if (profile) setUser(profile as { nome: string; cargo: string });
      }
      // Fetch NC count for badge
      const { count } = await supabase.from('nao_conformidades' as never).select('*', { count: 'exact', head: true }).eq('status', 'aberta');
      setNcCount(count || 0);
    }
    loadData();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getInitials = (name: string) => {
    if (!name) return 'PR';
    const parts = name.split(' ');
    if (parts.length === 1) return name.slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ width: 'var(--sb-w)', background: 'var(--txt)' }}
    >
      {/* Logo */}
      <div className="px-5 pt-[18px] pb-[14px]" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="text-white text-base font-semibold tracking-tight">PrumoQ</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>
          Gestão de Qualidade
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3">
        {NAV.map((section) => (
          <div key={section.label} className="mb-2">
            <div
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.8px]"
              style={{ color: 'rgba(255,255,255,.3)' }}
            >
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              const isNC = 'alert' in item && item.alert;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13px] transition-colors mb-0.5"
                  style={{
                    background: active ? 'var(--br)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,.65)',
                  }}
                >
                  <Icon size={15} />
                  <span className="flex-1">{item.title}</span>
                  {isNC && ncCount > 0 && (
                    <span className="bg-nok text-white text-[10px] font-semibold px-1.5 py-px rounded-full leading-none">
                      {ncCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-[rgba(255,255,255,.08)]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-[7px] cursor-pointer hover:bg-[rgba(255,255,255,.06)]">
          <div className="w-8 h-8 rounded-full bg-[var(--brm)] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
            {getInitials(user?.nome || '')}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="text-xs font-medium text-[rgba(255,255,255,.85)] truncate">
              {user?.nome || 'Carregando...'}
            </div>
            <div className="text-[11px] text-[rgba(255,255,255,.4)] truncate">
              {user?.cargo || 'Administrador'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-[7px] text-[13px] mt-1 transition-colors"
          style={{ color: 'rgba(255,255,255,.4)' }}
        >
          <LogOut size={15} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
