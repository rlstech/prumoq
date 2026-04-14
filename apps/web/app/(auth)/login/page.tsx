'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await loginAction(null, formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        router.push('/dashboard');
      }
    });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--br)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-3xl font-semibold tracking-tight">PrumoQ</h1>
          <p className="text-white/75 text-sm mt-1">Gestão da Qualidade para Obras</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-medium text-txt mb-5">Entrar como administrador</h2>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">E-mail</label>
              <input
                type="email"
                name="email"
                className="w-full px-3 py-2 border border-[var(--brd1)] rounded text-sm text-txt outline-none focus:border-[var(--br)]"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">Senha</label>
              <input
                type="password"
                name="password"
                className="w-full px-3 py-2 border border-[var(--brd1)] rounded text-sm text-txt outline-none focus:border-[var(--br)]"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-nok">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-[var(--br)] hover:bg-[var(--brd)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {isPending ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-txt-3 text-center mt-4">
            Acesso restrito a administradores e gestores.
          </p>
        </div>
      </div>
    </div>
  );
}
