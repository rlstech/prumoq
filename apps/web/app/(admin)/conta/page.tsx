import Header from '@/components/layout/Header';
import ChangePasswordForm from './ChangePasswordForm';

export default function AccountPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: 'Minha conta' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
          <div className="max-w-2xl">
            <p className="prumo-kicker text-[var(--prumo-brand)]">Segurança da conta</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-txt">
              Alterar senha
            </h1>
            <p className="mt-2 text-sm text-txt-2">
              Atualize suas credenciais de acesso ao painel PrumoQ.
            </p>
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </>
  );
}
