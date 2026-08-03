import { createClient } from '@/lib/supabase/server';
import ClientesClient from './ClientesClient';

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_clientes_resumo');
  if (error) throw new Error(error.message);
  return <ClientesClient initialData={data ?? []} />;
}
