'use client';

import { useState, useTransition } from 'react';
import type { Database } from '@prumoq/shared';
import { Building2, Clock3, Plus, UserCheck, UserX } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/layout/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
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

  const columns: Column<Cliente>[] = [
    {
      header: 'Cliente',
      cell: cliente => (
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-pg" />
          <div>
            <div className="font-semibold text-txt">{cliente.nome}</div>
            <div className="text-xs text-txt-2">{cliente.slug} · {cliente.contato_email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Situação',
      cell: cliente => (
        <span className={cliente.status === 'ativo' ? 'text-ok' : 'text-warn'}>
          {cliente.status === 'ativo' ? 'Ativo' : 'Suspenso'}
        </span>
      ),
    },
    { header: 'Administrador', cell: cliente => <AdminOnboardingStatus status={cliente.admin_onboarding_status} /> },
    { header: 'Usuários', cell: cliente => <>{cliente.usuarios_ativos}/{cliente.limite_usuarios ?? '∞'}</> },
    { header: 'Empresas', cell: cliente => <>{cliente.empresas_ativas}/{cliente.limite_empresas ?? '∞'}</> },
    { header: 'Obras', cell: cliente => <>{cliente.obras_ativas}/{cliente.limite_obras ?? '∞'}</> },
    {
      header: '',
      align: 'right',
      cell: cliente => (
        <button
          type="button"
          disabled={pending}
          className="prumo-row-button"
          onClick={event => { event.stopPropagation(); toggleStatus(cliente); }}
        >
          {cliente.status === 'ativo' ? 'Suspender' : 'Reativar'}
        </button>
      ),
    },
  ];

  return (
    <div className="prumo-page"><div className="prumo-page-inner">
      <PageHeader
        kicker="Administração SaaS"
        title="Clientes"
        description="Contas de cliente da plataforma, com uso de usuários, empresas e obras por conta."
        actions={
          <button type="button" className="prumo-primary-button" onClick={() => setOpen(true)}>
            <Plus size={16} /> Novo cliente
          </button>
        }
      />
      {error ? <div className="rounded-lg border border-nok/20 bg-nok-bg p-3 text-sm text-nok">{error}</div> : null}
      <DataTable
        data={initialData}
        columns={columns}
        rowKey={cliente => cliente.id}
        emptyMessage="Nenhum cliente cadastrado"
      />
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
