import { ShieldAlert } from '@/components/icons';

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-0 p-6">
      <section className="prumo-panel max-w-lg p-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warn-bg text-warn"><ShieldAlert size={32} /></span>
        <h1 className="mt-5 text-[28px] font-extrabold tracking-[-0.02em] text-txt">Ambiente suspenso</h1>
        <p className="mt-3 text-sm leading-6 text-txt-2">
          O acesso deste cliente está temporariamente bloqueado. Entre em contato com o suporte PrumoQ.
        </p>
        <a href="/admin/login" className="prumo-primary-button mt-6 inline-flex">Voltar ao login</a>
      </section>
    </main>
  );
}
