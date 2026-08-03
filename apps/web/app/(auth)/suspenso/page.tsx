import { ShieldAlert } from 'lucide-react';

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-0 p-6">
      <section className="prumo-panel max-w-lg p-8 text-center">
        <ShieldAlert className="mx-auto text-warn" size={36} />
        <h1 className="mt-5 text-2xl font-semibold text-txt">Ambiente suspenso</h1>
        <p className="mt-3 text-sm leading-6 text-txt-2">
          O acesso deste cliente está temporariamente bloqueado. Entre em contato com o suporte PrumoQ.
        </p>
        <a href="/admin/login" className="prumo-primary-button mt-6 inline-flex">Voltar ao login</a>
      </section>
    </main>
  );
}
