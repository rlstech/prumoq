'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Building2,
  ClipboardList,
  Layers,
  HardHat,
  Users,
  ScanLine,
  AlertTriangle,
  BarChart2,
} from 'lucide-react';

const NAV = [
  { label: 'PRINCIPAL', items: [
    { href: '/dashboard', icon: LayoutGrid,     title: 'Dashboard' },
    { href: '/obras',     icon: Building2,       title: 'Obras' },
  ]},
  { label: 'QUALIDADE', items: [
    { href: '/fvs-padrao',    icon: ClipboardList, title: 'FVS Padrão' },
    { href: '/verificacoes',  icon: ScanLine,      title: 'Verificações' },
    { href: '/nc',            icon: AlertTriangle, title: 'Não Conformidades', alert: true },
    { href: '/relatorios',    icon: BarChart2,     title: 'Relatórios' },
  ]},
  { label: 'CADASTROS', items: [
    { href: '/equipes',  icon: HardHat,  title: 'Equipes' },
    { href: '/usuarios', icon: Users,    title: 'Usuários' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ width: 'var(--sb-w)', background: 'var(--txt)' }}
    >
      {/* Logo */}
      <div className="px-5 pt-[18px] pb-[14px]" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="text-white text-base font-semibold tracking-tight">PrumoQ</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>
          Gestão da Qualidade
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
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
