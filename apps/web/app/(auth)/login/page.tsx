'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('E-mail ou senha inválidos.');
      setLoading(false);
      return;
    }

    // Reject inspectors — admin panel is for admin/gestor only
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('perfil')
      .eq('id', data.user.id)
      .single();

    if (usuario?.perfil === 'inspetor') {
      await supabase.auth.signOut();
      setError('Acesso restrito. Use o aplicativo móvel.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-txt-2 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              disabled={loading}
              className="w-full py-3 bg-[var(--br)] hover:bg-[var(--brd)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
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
