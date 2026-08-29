'use client';

import { useState } from 'react';
import { Plus, ShieldCheck, HardHat, KeyRound, Save } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataTable, { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchField } from '@/components/ui/FilterBar';
import { useToast } from '@/components/ui/Toast';
import { createUsuario, sendPasswordRecovery, updateUsuario } from './actions';

type TenantProfile = 'admin' | 'gestor' | 'inspetor';
type UsuarioForm = {
  nome: string;
  email: string;
  senha: string;
  perfil: TenantProfile;
  cargo: string;
  obras: string[];
};

export default function UsuariosClient({ initialUsers, availableObras }: { initialUsers: any[], availableObras: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [recoveryUser, setRecoveryUser] = useState<any>(null);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<UsuarioForm>({
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

  const handleSendRecovery = async () => {
    if (!recoveryUser) return;
    setIsSendingRecovery(true);
    const result = await sendPasswordRecovery(recoveryUser.id);
    if (result.success) {
      toast('E-mail de recuperação enviado com sucesso!', 'success');
      setRecoveryUser(null);
    } else {
      toast(`Erro: ${result.error}`, 'error');
    }
    setIsSendingRecovery(false);
  };

  const columns: Column<any>[] = [
    {
      header: 'Nome',
      cell: user => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brl)] text-[11px] font-semibold text-[var(--br)]">
            {user.nome ? (user.nome.split(' ').length > 1 ? user.nome.split(' ')[0][0] + user.nome.split(' ').pop()[0] : user.nome.slice(0, 2)).toUpperCase() : '?'}
          </div>
          <div>
            <div className="text-[13px] font-medium text-txt">{user.nome}</div>
            <div className="text-xs text-txt-2">{user.cargo || '-'}</div>
          </div>
        </div>
      ),
    },
    { header: 'E-mail', cell: user => <span className="text-[13px] text-txt">{user.email || '-'}</span> },
    { header: 'Perfil', cell: user => getPerfilBadge(user.perfil) },
    {
      header: 'Obras com acesso',
      cell: user => user.perfil === 'admin' ? (
        <span className="text-xs text-txt-3">Todas as obras</span>
      ) : user.obras_acesso && user.obras_acesso.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {user.obras_acesso.map((o: any, idx: number) => (
            <span key={idx} className="rounded-full bg-pg-bg px-1.5 py-0.5 text-[10px] font-medium text-pg">{o.nome || o}</span>
          ))}
        </div>
      ) : user.obras?.nome ? (
        <span className="rounded-full bg-pg-bg px-1.5 py-0.5 text-[10px] font-medium text-pg">{user.obras.nome}</span>
      ) : (
        <span className="text-xs text-txt-3">—</span>
      ),
    },
    {
      header: 'Último acesso',
      cell: user => (
        <span className="text-[13px] text-txt">
          {user.ultimo_acesso ? new Date(user.ultimo_acesso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
        </span>
      ),
    },
    {
      header: '',
      align: 'right',
      cell: user => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setRecoveryUser(user)} className="prumo-row-button">
            <KeyRound size={12} /> Recuperar senha
          </button>
          <button type="button" onClick={() => openEditUserModal(user)} className="prumo-row-button">Editar</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <FilterBar resultLabel={`${filtered.length} de ${initialUsers.length} pessoas`}>
        <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nome ou e-mail" />
        <button type="button" onClick={openNewUserModal} className="prumo-primary-button ml-auto">
          <Plus size={15} /> Novo usuário
        </button>
      </FilterBar>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={user => user.id}
        emptyMessage="Nenhuma pessoa neste recorte"
        emptyHint="Ajuste a busca para ver as pessoas cadastradas."
      />

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
             {!selectedUser ? <div>
               <label className="block text-xs font-medium text-txt-2 mb-1">
                 Senha *
               </label>
               <input type="password" required minLength={8} placeholder="Mínimo 8 caracteres" className="w-full px-3 py-2 border border-brd-1 rounded text-[13px] bg-bg-0 outline-none focus:border-[var(--br)]" value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} />
             </div> : null}
             <div className={selectedUser ? 'col-span-2' : undefined}>
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
                       onChange={() => setFormData({...formData, perfil: p.id as TenantProfile})}
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
             <button type="button" onClick={() => setIsModalOpen(false)} className="prumo-secondary-button">
               Cancelar
             </button>
             <button type="submit" disabled={isLoading} className="prumo-primary-button disabled:opacity-60">
               {isLoading ? 'Salvando...' : <><Save size={16} /> Salvar Usuário</>}
             </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!recoveryUser}
        onClose={() => setRecoveryUser(null)}
        onConfirm={handleSendRecovery}
        title="Enviar recuperação de senha"
        message={`Enviar um link de recuperação para ${recoveryUser?.nome ?? 'este usuário'}? A senha atual não será exibida nem alterada pelo administrador.`}
        confirmText="Enviar e-mail"
        variant="info"
        isLoading={isSendingRecovery}
      />
    </>
  );
}
