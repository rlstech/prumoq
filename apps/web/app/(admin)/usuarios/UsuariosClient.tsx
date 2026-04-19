'use client';

import { useState } from 'react';
import { Search, Plus, ShieldCheck, HardHat, Save } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createUsuario, updateUsuario } from './actions';

export default function UsuariosClient({ initialUsers, availableObras }: { initialUsers: any[], availableObras: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'inspetor',
    cargo: '',
    obras: [] as string[]
  });

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

  const openNewUserModal = () => {
    setSelectedUser(null);
    setFormData({ nome: '', email: '', senha: '', perfil: 'inspetor', cargo: '', obras: [] });
    setIsModalOpen(true);
  };

  const openEditUserModal = (user: any) => {
    setSelectedUser(user);
    setFormData({
      nome: user.nome || '',
      email: user.email || '',
      senha: '', // Omitir senha na edição (deve ser atualizada separadamente num fluxo real se necessário)
      perfil: user.perfil || 'inspetor',
      cargo: user.cargo || '',
      obras: user.obras_acesso ? user.obras_acesso.map((o: any) => o.id || o) : []
    });
    setIsModalOpen(true);
  };

  const toggleObra = (obraId: string) => {
    setFormData(prev => ({
      ...prev,
      obras: prev.obras.includes(obraId) 
        ? prev.obras.filter(id => id !== obraId) 
        : [...prev.obras, obraId]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let res;
    if (selectedUser) {
      res = await updateUsuario(selectedUser.id, formData);
    } else {
      res = await createUsuario(formData);
    }

    if (res.success) {
      toast(`Usuário ${selectedUser ? 'atualizado' : 'criado'} com sucesso!`, 'success');
      setIsModalOpen(false);
    } else {
      toast(`Erro: ${res.error}`, 'error');
    }
    
    setIsLoading(false);
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
            onClick={openNewUserModal}
            className="flex items-center gap-1.5 bg-[var(--br)] hover:bg-[var(--brd)] text-white px-4 py-[7px] rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap"
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
                  <td className="py-3 px-4 text-[13px] text-txt">{user.ultimo_acesso ? new Date(user.ultimo_acesso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => openEditUserModal(user)} className="px-2.5 py-1 bg-bg-0 border border-brd-1 rounded text-xs font-medium text-txt-2 hover:bg-bg-2 transition-colors">Editar</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-txt-3">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedUser ? "Editar Usuário" : "Novo Usuário"}>
        <form onSubmit={handleSave} className="flex flex-col gap-4 p-2">
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-xs font-medium text-txt-2 mb-1">Nome Completo *</label>
               <input type="text" required className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-medium text-txt-2 mb-1">E-mail *</label>
               <input type="email" required className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-xs font-medium text-txt-2 mb-1">
                 Senha {selectedUser ? '(deixe em branco para manter)' : '*'}
               </label>
               <input type="password" required={!selectedUser} placeholder={selectedUser ? '' : 'Mínimo 6 caracteres'} className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]" value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-medium text-txt-2 mb-1">Cargo</label>
               <input type="text" className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]" placeholder="Ex: Mestre de Obras" value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} />
             </div>
          </div>

          <div>
             <label className="block text-xs font-medium text-txt-2 mb-2">Perfil de Acesso *</label>
             <div className="flex gap-4">
                 {[
                   { id: 'inspetor', label: 'Inspetor', icon: <HardHat size={14} className="mr-1.5" /> },
                   { id: 'gestor', label: 'Gestor', icon: <ShieldCheck size={14} className="mr-1.5" /> },
                   { id: 'admin', label: 'Administrador', icon: <ShieldCheck size={14} className="mr-1.5" /> }
                 ].map(p => (
                   <label key={p.id} className="flex items-center gap-2 text-sm text-txt cursor-pointer">
                     <input type="radio" className="accent-[var(--br)]" name="perfil" 
                       checked={formData.perfil === p.id} 
                       onChange={() => setFormData({...formData, perfil: p.id})} 
                     />
                     <span className="flex items-center">{p.icon}{p.label}</span>
                   </label>
                 ))}
             </div>
          </div>

          {formData.perfil !== 'admin' && (
            <div className="mt-2 p-4 border border-brd-0 rounded-lg bg-bg-0">
               <label className="block text-xs font-medium text-txt-2 mb-2 uppercase tracking-wider">Obras Vinculadas</label>
               <p className="text-[11px] text-txt-3 mb-3">Selecione as obras que este usuário pode acessar.</p>
               
               <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                 {availableObras.length === 0 ? (
                   <p className="text-xs text-txt-3 italic">Nenhuma obra cadastrada no sistema.</p>
                 ) : (
                   availableObras.map(obra => (
                     <label key={obra.id} className="flex items-start gap-2 p-2 hover:bg-bg-1 rounded cursor-pointer border border-transparent hover:border-brd-0 transition-colors">
                       <input 
                         type="checkbox" 
                         className="accent-[var(--br)] mt-0.5"
                         checked={formData.obras.includes(obra.id)}
                         onChange={() => toggleObra(obra.id)}
                       />
                       <span className="text-[13px] text-txt font-medium leading-tight">{obra.nome}</span>
                     </label>
                   ))
                 )}
               </div>
            </div>
          )}

          {formData.perfil === 'admin' && (
             <div className="mt-2 p-3 bg-pg-bg text-pg rounded-lg border border-pg/20">
               <p className="text-xs font-medium">Administradores possuem acesso total a todas as obras do sistema.</p>
             </div>
          )}

          <div className="flex gap-3 justify-end pt-3 border-t border-brd-0 mt-2">
             <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">
               Cancelar
             </button>
             <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
               {isLoading ? 'Salvando...' : <><Save size={16} /> Salvar Usuário</>}
             </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
