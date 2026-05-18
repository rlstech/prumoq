import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PrintClient from './PrintClient';

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? 'https://pub-fd4eb9827712433599dec5fe1fef3fa5.r2.dev';

function resolveR2(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith('http') || key.startsWith('data:')) return key;
  if (key.startsWith('pending:')) return null;
  return `${R2_BASE}/${key}`;
}

export default async function FvsRelatorioPage({ params }: { params: { fvsId: string } }) {
  const { fvsId } = params;
  const sb = (await createClient()) as any;

  const [headerRes, verifsRes, fotosRes, ncsRes, conclusaoRes] = await Promise.all([
    sb.rpc('get_fvs_header', { p_fvs_id: fvsId }),
    sb.rpc('get_verificacoes_fvs', { p_fvs_id: fvsId }),
    sb.rpc('get_fotos_fvs', { p_fvs_id: fvsId }),
    sb.rpc('get_ncs_fvs', { p_fvs_id: fvsId }),
    sb.from('fvs_conclusoes')
      .select('numero_conclusao, percentual_final, resultado, observacao_final, assinatura_url, inspetor_id, created_at')
      .eq('fvs_planejada_id', fvsId)
      .order('numero_conclusao', { ascending: false })
      .limit(1),
  ]);

  const header = (headerRes.data ?? [])[0];
  if (!header) return notFound();

  const verificacoes: any[] = [...(verifsRes.data ?? [])].reverse();

  const verifIds = verificacoes.map((v: any) => v.id);
  const { data: allItems } = verifIds.length > 0
    ? await sb.from('verificacao_itens')
        .select('id, verificacao_id, ordem, titulo, metodo_verif, tolerancia, resultado')
        .in('verificacao_id', verifIds)
        .order('ordem')
    : { data: [] };

  const fotosMap: Record<string, { id: string; r2_url: string; ordem: number }[]> = {};
  for (const f of (fotosRes.data ?? [])) {
    const url = resolveR2(f.r2_key);
    if (!url) continue;
    if (!fotosMap[f.verificacao_id]) fotosMap[f.verificacao_id] = [];
    fotosMap[f.verificacao_id].push({ id: f.id, r2_url: url, ordem: f.ordem ?? 0 });
  }

  const itemsMap: Record<string, any[]> = {};
  for (const item of (allItems ?? [])) {
    if (!itemsMap[item.verificacao_id]) itemsMap[item.verificacao_id] = [];
    itemsMap[item.verificacao_id].push(item);
  }

  const verifsData = verificacoes.map((v: any) => ({
    ...v,
    assinatura_url: resolveR2(v.assinatura_url),
    items: itemsMap[v.id] ?? [],
    fotos: fotosMap[v.id] ?? [],
  }));

  const conclusao = (conclusaoRes.data ?? [])[0] ?? null;

  return (
    <PrintClient
      header={header}
      verificacoes={verifsData}
      ncs={ncsRes.data ?? []}
      conclusao={conclusao}
      emitidoEm={new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
    />
  );
}
