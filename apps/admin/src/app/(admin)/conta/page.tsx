import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import ChangePasswordForm from './ChangePasswordForm';

export default function AccountPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: 'Minha conta' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
          <div className="max-w-2xl">
            <PageHeader
              title="Minha conta"
              description="Atualize suas credenciais de acesso ao painel PrumoQ."
            />
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </>
  );
}
