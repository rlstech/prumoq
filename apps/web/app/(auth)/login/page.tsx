'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck, Wifi } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await loginAction(null, formData);
      if (result?.error) setError(result.error);
      else if (result?.success) router.push('/dashboard');
    });
  }

  return (
    <main className="min-h-screen bg-sidebar p-3 sm:p-6 lg:grid lg:grid-cols-[1.12fr_.88fr] lg:p-8">
      <section className="relative hidden min-h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-white/10 bg-[var(--prumo-brand-deep)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden="true">
          <div className="absolute left-[16%] top-0 h-full w-px bg-accent" />
          <div className="absolute left-[16%] top-[28%] h-px w-20 bg-accent" />
          <div className="absolute left-[16%] top-[28%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
          <div className="absolute right-[-10%] top-[-8%] h-[520px] w-[520px] rounded-full border border-accent" />
          <div className="absolute right-[-4%] top-[-2%] h-[360px] w-[360px] rounded-full border border-white/30" />
        </div>

        <div className="relative flex items-center gap-3">
          <BrandMark />
          <div>
            <div className="text-xl font-semibold tracking-[-.03em]">PrumoQ</div>
            <div className="text-xs font-medium uppercase tracking-[.16em] text-accent">Qualidade em eixo</div>
          </div>
        </div>

        <div className="relative max-w-[650px]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.18em] text-accent">Centro de controle</p>
          <h1 className="max-w-[620px] text-[54px] font-semibold leading-[1.02] tracking-[-.045em]">
            Decisões de obra com evidência, contexto e precisão.
          </h1>
          <p className="mt-6 max-w-[520px] text-lg leading-7 text-white/65">
            Planeje FVS, acompanhe execução e elimine não conformidades em uma operação conectada ao campo.
          </p>
        </div>

        <div className="relative grid max-w-[720px] grid-cols-3 gap-4">
          {[
            { icon: CheckCircle2, title: 'Rastreável', text: 'Histórico completo por serviço' },
            { icon: Wifi, title: 'Conectado', text: 'Campo e gestão no mesmo fluxo' },
            { icon: ShieldCheck, title: 'Protegido', text: 'Acesso e dados isolados por obra' },
          ].map(item => (
            <div key={item.title} className="border-l border-white/15 pl-4">
              <item.icon size={18} className="mb-3 text-accent" />
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-white/50">{item.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-[calc(100vh-1.5rem)] items-center justify-center rounded-xl bg-bg-0 px-5 py-12 sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)] lg:rounded-l-none">
        <div className="w-full max-w-[430px]">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <div className="rounded-lg bg-sidebar p-2"><BrandMark /></div>
            <div>
              <div className="text-xl font-semibold tracking-tight text-txt">PrumoQ</div>
              <div className="text-xs font-medium uppercase tracking-[.14em] text-txt-2">Qualidade em eixo</div>
            </div>
          </div>

          <p className="prumo-kicker text-[var(--prumo-brand)]">Painel administrativo</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] text-txt">Bem-vindo de volta.</h2>
          <p className="mt-2 text-sm text-txt-2">Entre com suas credenciais para continuar a operação.</p>

          <form onSubmit={onSubmit} className="mt-9 flex flex-col gap-5">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-txt">E-mail corporativo</span>
              <input
                type="email"
                name="email"
                className="prumo-field"
                placeholder="voce@empresa.com.br"
                required
                autoComplete="email"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-txt">Senha</span>
              <input
                type="password"
                name="password"
                className="prumo-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <div role="alert" className="rounded-lg border border-nok/20 bg-nok-bg px-4 py-3 text-sm font-medium text-nok">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={isPending} className="prumo-primary-button mt-1 min-h-12 w-full disabled:opacity-60">
              {isPending ? 'Validando acesso…' : 'Entrar no painel'}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-3 border-t border-brd-0 pt-5 text-xs text-txt-3">
            <ShieldCheck size={16} />
            Acesso exclusivo para administradores e gestores.
          </div>
        </div>
      </section>
    </main>
  );
}
