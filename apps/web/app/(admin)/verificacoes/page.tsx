import { createAdminClient } from '@/lib/supabase/admin';
import Header from '@/components/layout/Header';
import VerificacoesClient from './VerificacoesClient';

export const dynamic = 'force-dynamic';

export default async function VerificacoesPage() {
  const supabaseAdmin = createAdminClient();
  const { data: verifs } = await supabaseAdmin
    .from('verificacoes' as any)
    .select('*, fvs_planejadas(subservico, ambientes(nome, obras(nome))), usuarios(nome), verificacao_fotos(count)')
    .order('data_verif', { ascending: false });

  return (
    <>
      <Header breadcrumbs={[{ label: 'Verificações' }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <VerificacoesClient initialData={verifs as any[] || []} />
        </div>
      </div>
    </>
  );
}
