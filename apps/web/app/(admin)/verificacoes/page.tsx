import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import VerificacoesClient from './VerificacoesClient';

export const dynamic = 'force-dynamic';

export default async function VerificacoesPage() {
  const supabase = await createClient();
  const { data: verifs } = await supabase
    .from('verificacoes' as any)
    .select('*, fvs_planejadas!verificacoes_fvs_planejada_id_fkey(subservico, ambientes!fvs_planejadas_ambiente_id_fkey(nome, obras!ambientes_obra_id_fkey(nome))), usuarios!inspetor_id(nome), verificacao_fotos!verificacao_fotos_verificacao_id_fkey(count)')
    .order('data_verif', { ascending: false });

  return (
    <>
      <Header breadcrumbs={[{ label: 'Verificações' }]} />
      <div className="prumo-page">
        <div className="prumo-page-inner">
          <VerificacoesClient initialData={verifs as any[] || []} />
        </div>
      </div>
    </>
  );
}
