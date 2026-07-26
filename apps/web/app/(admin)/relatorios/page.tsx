import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import RelatoriosClient from './RelatoriosClient';

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const { data: obras } = await supabase
    .from('obras')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome');

  return (
    <>
      <Header breadcrumbs={[{ label: 'Relatórios e Exportações' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
          <div>
            <p className="prumo-kicker text-[var(--prumo-brand)]">Central de dados</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-txt">Relatórios que orientam a obra.</h1>
            <p className="mt-2 max-w-2xl text-sm text-txt-2">Escolha o recorte, gere o arquivo e leve as evidências do campo para a tomada de decisão.</p>
          </div>
          <RelatoriosClient obras={obras ?? []} />
        </div>
      </div>
    </>
  );
}
