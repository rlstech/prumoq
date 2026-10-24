import { Suspense } from 'react';
import { CheckCircle2, Plumb, ShieldCheck, Wifi } from '@/components/icons';
import { BrandMark, BrandWordmark } from '@/components/ui/BrandMark';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg-0 p-3 lg:grid lg:grid-cols-[1.1fr_.9fr] lg:gap-3">
      <section className="on-brand hidden min-h-[calc(100vh-1.5rem)] flex-col justify-between rounded-2xl bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <BrandMark size={40} />
          <BrandWordmark className="text-[30px]" />
        </div>

        <div className="max-w-[620px]">
          <span className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-txt">
            <Plumb size={34} />
          </span>
          <h1 className="text-[52px] font-extrabold leading-[1.04] tracking-[-0.04em]">
            Decisões de obra com evidência, contexto e precisão.
          </h1>
          <p className="mt-6 max-w-[520px] text-lg leading-7 text-on-brand">
            Planeje FVS, acompanhe verificações e trate não conformidades em uma operação conectada ao campo.
          </p>
        </div>

        <div className="grid max-w-[720px] grid-cols-3 gap-2">
          {[
            { icon: CheckCircle2, title: 'Rastreável', text: 'Histórico completo por serviço' },
            { icon: Wifi, title: 'Conectado', text: 'Campo e gestão no mesmo fluxo' },
            { icon: ShieldCheck, title: 'Protegido', text: 'Acesso e dados isolados por obra' },
          ].map(item => (
            <div key={item.title} className="rounded-[22px] bg-[#26292D] p-4">
              <item.icon size={20} className="mb-3 text-accent" />
              <div className="text-sm font-bold">{item.title}</div>
              <div className="mt-1 text-[13px] leading-5 text-on-brand">{item.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-[calc(100vh-1.5rem)] items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-12 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar">
              <BrandMark size={30} />
            </span>
            <BrandWordmark variant="onLight" />
          </div>

          <p className="prumo-kicker">Painel administrativo</p>
          <Suspense>
            <LoginForm />
          </Suspense>

          <div className="mt-8 flex items-center gap-3 border-t border-brd-1 pt-5 text-[13px] text-txt-2">
            <ShieldCheck size={18} />
            Acesso exclusivo para administradores e gestores.
          </div>
        </div>
      </section>
    </main>
  );
}
