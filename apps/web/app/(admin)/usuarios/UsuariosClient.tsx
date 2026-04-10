'use client';

import { useState } from 'react';
import { Search, Plus, ShieldCheck, HardHat } from 'lucide-react';

export default function UsuariosClient({ initialUsers }: { initialUsers: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = initialUsers.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPerfilBadge = (perfil: string) => {
    switch (perfil) {
      case 'admin': return <span className="inline-flex items-center gap-1 bg-pg-bg text-pg px-2 py-0.5 rounded-full text-[11px] font-medium"><ShieldCheck size={10} />Administrador</span>;
      case 'gestor': return <span className="inline-flex items-center gap-1 bg-warn-bg text-warn px-2 py-0.5 rounded-full text-[11px] font-medium"><ShieldCheck size={10} />Gestor</span>;
      case 'inspetor': return <span className="inline-flex items-center gap-1 bg-ok-bg text-ok px-2 py-0.5 rounded-full text-[11px] font-medium"><HardHat size={10} />Inspetor</span>;
      default: return <span className="inline-flex bg-na-bg text-na px-2 py-0.5 rounded-full text-[11px] font-medium">{perfil}</span>;
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-txt">Usuários</h2>
          <p className="text-[13px] text-txt-2">{initialUsers.length} usuários ativos</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative w-full sm:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
            <input 
              type="text"
              placeholder="Buscar usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-[7px] border border-brd-1 rounded-lg text-[13px] bg-bg-1 focus:outline-none focus:border-[var(--br)]"
            />
          </div>
          <button 
            className="flex items-center gap-1.5 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-[7px] rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap"
            title="Criar via Supabase Admin API"
          >
            <Plus size={14} /> Novo usuário
          </button>
        </div>
      </div>

      <div className="bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-0 border-b border-brd-0">
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Nome</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">E-mail</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Perfil</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Obras com acesso</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase">Último acesso</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((user: any) => (
                <tr key={user.id} className="border-b border-brd-0 last:border-0 hover:bg-bg-0">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--brl)] text-[var(--br)] flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {user.nome ? (user.nome.split(' ').length > 1 ? user.nome.split(' ')[0][0] + user.nome.split(' ').pop()[0] : user.nome.slice(0,2)).toUpperCase() : '?'}
                      </div>
                      <div>
                        <div className="font-medium text-[13px] text-txt">{user.nome}</div>
                        <div className="text-xs text-txt-2">{user.cargo || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[13px] text-txt">{user.email || '-'}</td>
                  <td className="py-3 px-4">{getPerfilBadge(user.perfil)}</td>
                  <td className="py-3 px-4">
                    {user.perfil === 'admin' ? (
                      <span className="text-xs text-txt-3">Todas as obras</span>
                    ) : user.obras_acesso && user.obras_acesso.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {user.obras_acesso.map((o: any, idx: number) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-full bg-pg-bg text-pg font-medium">{o.nome || o}</span>
                        ))}
                      </div>
                    ) : user.obras?.nome ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pg-bg text-pg font-medium">{user.obras.nome}</span>
                    ) : (
                      <span className="text-xs text-txt-3">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[13px] text-txt">{user.ultimo_acesso ? new Date(user.ultimo_acesso).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="py-3 px-4">
                    <button className="px-2.5 py-1 bg-bg-0 border border-brd-1 rounded text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors">Editar</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-txt-3">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
