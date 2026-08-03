'use client';

import { useState, useTransition } from 'react';
import type { Database } from '@prumoq/shared';
import { Building2, Clock3, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { createCliente, updateCliente } from './actions';

type Cliente = Database['public']['Functions']['get_clientes_resumo']['Returns'][number];

const emptyForm = {
  nome: '', slug: '', contato_nome: '', contato_email: '', contato_telefone: '',
  limite_usuarios: '', limite_empresas: '', limite_obras: '',
};

function AdminOnboardingStatus({ status }: { status: string }) {
  if (status === 'ativado') {
    return <span className="inline-flex items-center gap-1.5 text-ok"><UserCheck size={15} /> Ativado</span>;
  }
  if (status === 'aguardando_ativacao') {
    return <span className="inline-flex items-center gap-1.5 text-warn"><Clock3 size={15} /> Aguardando ativação</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-nok"><UserX size={15} /> Sem administrador</span>;
}

export default function ClientesClient({ initialData }: { initialData: Cliente[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCliente(form);
      if (!result.success) setError(result.error);
      else { setOpen(false); setForm(emptyForm); window.location.reload(); }
    });
  }

  function toggleStatus(cliente: Cliente) {
    startTransition(async () => {
      const result = await updateCliente({
        ...cliente,
        status: cliente.status === 'ativo' ? 'suspenso' : 'ativo',
      });
      if (!result.success) setError(result.error);
      else window.location.reload();
    });
  }

  return (
    <div className="prumo-page"><div className="prumo-page-inner">
      <div className="flex items-end justify-between gap-4">
        <div><p className="prumo-kicker text-[var(--prumo-brand)]">Administração SaaS</p><h1 className="mt-2 text-2xl font-semibold text-txt">Clientes</h1></div>
        <button className="prumo-primary-button" onClick={() => setOpen(true)}><Plus size={16} /> Novo cliente</button>
      </div>
      {error ? <div className="rounded-lg border border-nok/20 bg-nok-bg p-3 text-sm text-nok">{error}</div> : null}
      <div className="prumo-panel overflow-x-auto">
        <table className="w-full text-left text-sm"><thead><tr className="border-b border-brd-0 text-xs uppercase text-txt-2">
          <th className="p-4">Cliente</th><th className="p-4">Ambiente</th><th className="p-4">Administrador</th><th className="p-4">Usuários</th><th className="p-4">Empresas</th><th className="p-4">Obras</th><th className="p-4">Ação</th>
        </tr></thead><tbody>{initialData.map(cliente => <tr key={cliente.id} className="border-b border-brd-0 last:border-0">
          <td className="p-4"><div className="flex items-center gap-3"><Building2 size={18} className="text-pg" /><div><div className="font-semibold text-txt">{cliente.nome}</div><div className="text-xs text-txt-2">{cliente.slug} · {cliente.contato_email}</div></div></div></td>
          <td className="p-4"><span className={cliente.status === 'ativo' ? 'text-ok' : 'text-warn'}>{cliente.status === 'ativo' ? 'Ativo' : 'Suspenso'}</span></td>
          <td className="p-4"><AdminOnboardingStatus status={cliente.admin_onboarding_status} /></td>
          <td className="p-4">{cliente.usuarios_ativos}/{cliente.limite_usuarios ?? '∞'}</td>
          <td className="p-4">{cliente.empresas_ativas}/{cliente.limite_empresas ?? '∞'}</td>
          <td className="p-4">{cliente.obras_ativas}/{cliente.limite_obras ?? '∞'}</td>
          <td className="p-4"><button disabled={pending} className="text-xs font-semibold text-[var(--prumo-brand)]" onClick={() => toggleStatus(cliente)}>{cliente.status === 'ativo' ? 'Suspender' : 'Reativar'}</button></td>
        </tr>)}</tbody></table>
        {!initialData.length ? <div className="p-10 text-center text-sm text-txt-2"><ShieldCheck className="mx-auto mb-3" />Nenhum cliente cadastrado.</div> : null}
      </div>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Novo cliente SaaS">
        <form onSubmit={submit} className="space-y-4">
          {(['nome','slug','contato_nome','contato_email','contato_telefone'] as const).map(key => <label key={key} className="block"><span className="mb-1 block text-xs font-medium text-txt-2">{key.replaceAll('_',' ')}</span><input className="prumo-field" type={key === 'contato_email' ? 'email' : 'text'} required={key === 'nome' || key === 'slug' || key === 'contato_email'} value={form[key]} onChange={e => setForm(v => ({...v,[key]:e.target.value}))} /></label>)}
          <div className="grid grid-cols-3 gap-3">{(['limite_usuarios','limite_empresas','limite_obras'] as const).map(key => <label key={key}><span className="mb-1 block text-xs text-txt-2">{key.replace('limite_','')}</span><input className="prumo-field" type="number" min="1" placeholder="∞" value={form[key]} onChange={e => setForm(v => ({...v,[key]:e.target.value}))} /></label>)}</div>
          {error ? <div className="text-sm text-nok">{error}</div> : null}
          <button disabled={pending} className="prumo-primary-button w-full">{pending ? 'Criando…' : 'Criar e convidar administrador'}</button>
        </form>
      </Modal>
    </div></div>
  );
}
