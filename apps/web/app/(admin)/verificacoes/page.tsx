import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import VerificacoesClient from './VerificacoesClient';

export default async function VerificacoesPage() {
  const supabase = await createClient();

  const { data: verifs } = await supabase
    .from('verificacoes' as any)
    .select('*, fvs_planejadas(subservico, ambientes(nome, obras(nome))), usuarios(nome), verificacao_fotos(count)')
    .order('data_verif', { ascending: false })
    .limit(100);

  return (
    <>
      <Header breadcrumbs={[{ label: 'Verificações' }]} />
      <div className="max-w-[1200px] mx-auto space-y-6 mt-6 px-6 pb-12">
        <VerificacoesClient initialData={verifs as any[] || []} />
      </div>
    </>
  );
}
