'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import {
  changePasswordSchema,
  getPasswordAuthErrorMessage,
} from '@/lib/auth/passwords';
import { createClient } from '@/lib/supabase/client';

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  async function finishGlobalSignOut() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      setError(
        'A senha foi alterada, mas não foi possível encerrar todas as sessões. Tente novamente.',
      );
      setLoading(false);
      return;
    }
    window.location.assign('/admin/login?senha=alterada');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmation,
    });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Revise os campos informados.');
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: validation.data.newPassword,
      current_password: validation.data.currentPassword,
    });
    if (updateError) {
      setError(getPasswordAuthErrorMessage(updateError.message));
      setLoading(false);
      return;
    }

    setPasswordChanged(true);
    await finishGlobalSignOut();
  }

  return (
    <form onSubmit={handleSubmit} className="prumo-panel mt-7 space-y-5 p-5 sm:p-7">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-light text-brand">
        <KeyRound size={23} />
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-txt">Senha atual</span>
        <input
          type="password"
          className="prumo-field"
          value={currentPassword}
          onChange={event => {
            setCurrentPassword(event.target.value);
            setError(null);
          }}
          autoComplete="current-password"
          required
          disabled={passwordChanged}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-txt">Nova senha</span>
        <input
          type="password"
          className="prumo-field"
          value={newPassword}
          onChange={event => {
            setNewPassword(event.target.value);
            setError(null);
          }}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={passwordChanged}
        />
        <span className="block text-xs text-txt-3">Use pelo menos 8 caracteres.</span>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-txt">Confirmar nova senha</span>
        <input
          type="password"
          className="prumo-field"
          value={confirmation}
          onChange={event => {
            setConfirmation(event.target.value);
            setError(null);
          }}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={passwordChanged}
        />
      </label>

      <div className="flex items-start gap-3 rounded-lg bg-bg-2 p-4 text-sm text-txt-2">
        <ShieldCheck size={19} className="mt-0.5 shrink-0" />
        <p>Após a alteração, será necessário entrar novamente em todos os dispositivos.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-nok/20 bg-nok-bg px-4 py-3 text-sm font-medium text-nok">
          {error}
        </div>
      ) : null}

      {passwordChanged ? (
        <button
          type="button"
          onClick={finishGlobalSignOut}
          disabled={loading}
          className="prumo-primary-button min-h-12 w-full disabled:opacity-60"
        >
          {loading ? 'Encerrando sessões…' : 'Encerrar sessões e voltar ao login'}
        </button>
      ) : (
        <button
          type="submit"
          disabled={loading}
          className="prumo-primary-button min-h-12 w-full disabled:opacity-60"
        >
          {loading ? 'Alterando senha…' : 'Alterar senha'}
        </button>
      )}
    </form>
  );
}
