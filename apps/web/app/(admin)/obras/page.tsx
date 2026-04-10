import { createClient } from '@/lib/supabase/server';
import ObrasClient from './ObrasClient';

export default async function ObrasPage() {
  const supabase = await createClient();

  const [
    { data: obras },
    { data: empresas }
  ] = await Promise.all([
    supabase.rpc('get_obras_com_fvs'), // Will fail if RPC not returning proper type but we type it, actually it's fine.
    supabase.from('empresas').select('id, nome, cnpj').eq('ativo', true)
  ]);

  return (
    <ObrasClient 
      initialObras={obras || []} 
      empresas={empresas || []} 
    />
  );
}
