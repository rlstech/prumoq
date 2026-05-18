import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';

const R2_BASE = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '';

function resolveR2(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith('http') || key.startsWith('data:')) return key;
  if (key.startsWith('pending:')) return null;
  return `${R2_BASE}/${key}`;
}

function localDate(str: string | null | undefined) {
  if (!str) return '—';
  return new Date(str.length === 10 ? str + 'T00:00:00' : str).toLocaleDateString('pt-BR');
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente', em_andamento: 'Em Andamento', conforme: 'Conforme',
  nao_conforme: 'Não Conforme', concluida: 'Concluída',
  concluida_ressalva: 'Concluída c/ Ressalva', em_revisao: 'Em Revisão',
};

export default function FvsPrintPage() {
  const { fvsId } = useLocalSearchParams<{ fvsId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!fvsId) return;
    (async () => {
      try {
        const [headerRes, verifsRes, fotosRes, ncsRes, conclusaoRes] = await Promise.all([
          supabase.rpc('get_fvs_header' as any, { p_fvs_id: fvsId }),
          supabase.rpc('get_verificacoes_fvs' as any, { p_fvs_id: fvsId }),
          supabase.rpc('get_fotos_fvs' as any, { p_fvs_id: fvsId }),
          supabase.rpc('get_ncs_fvs' as any, { p_fvs_id: fvsId }),
          supabase.from('fvs_conclusoes' as any)
            .select('numero_conclusao, percentual_final, resultado, observacao_final')
            .eq('fvs_planejada_id', fvsId).order('numero_conclusao', { ascending: false }).limit(1),
        ]);

        const header = (headerRes.data as any[])?.[0];
        if (!header) { setError(true); setLoading(false); return; }

        const verificacoes = [...((verifsRes.data as any[]) ?? [])].reverse();
        const verifIds = verificacoes.map((v: any) => v.id);

        const { data: allItems } = verifIds.length > 0
          ? await supabase.from('verificacao_itens' as any)
              .select('id, verificacao_id, ordem, titulo, metodo_verif, tolerancia, resultado')
              .in('verificacao_id', verifIds).order('ordem')
          : { data: [] as any[] };

        const fotosMap: Record<string, any[]> = {};
        for (const f of (fotosRes.data as any[]) ?? []) {
          const url = resolveR2(f.r2_key); if (!url) continue;
          if (!fotosMap[f.verificacao_id]) fotosMap[f.verificacao_id] = [];
          fotosMap[f.verificacao_id].push({ id: f.id, r2_url: url, ordem: f.ordem ?? 0 });
        }
        const itemsMap: Record<string, any[]> = {};
        for (const item of (allItems ?? []) as any[]) {
          if (!itemsMap[item.verificacao_id]) itemsMap[item.verificacao_id] = [];
          itemsMap[item.verificacao_id].push(item);
        }

        setData({
          header,
          verificacoes: verificacoes.map((v: any) => ({
            ...v, assinatura_url: resolveR2(v.assinatura_url),
            items: itemsMap[v.id] ?? [], fotos: fotosMap[v.id] ?? [],
          })),
          ncs: (ncsRes.data as any[]) ?? [],
          conclusao: (conclusaoRes.data as any[])?.[0] ?? null,
          emitidoEm: new Date().toLocaleDateString('pt-BR'),
        });
      } catch { setError(true); }
      setLoading(false);
    })();
  }, [fvsId]);

  useEffect(() => {
    if (loading || !data) return;
    const imgs = Array.from(document.images) as HTMLImageElement[];
    if (imgs.length === 0) { window.print(); return; }
    let done = 0;
    const tryPrint = () => { done++; if (done >= imgs.length) window.print(); };
    imgs.forEach(img => { if (img.complete) tryPrint(); else { img.onload = tryPrint; img.onerror = tryPrint; } });
  }, [loading, data]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#9C9A93', gap: 12 }}>
      <span style={{ fontSize: 20 }}>⏳</span> Preparando relatório...
    </div>
  );
  if (error || !data?.header) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#C62828' }}>
      FVS não encontrada ou sem permissão.
    </div>
  );

  const { header, verificacoes, ncs, conclusao, emitidoEm } = data;
  const ncsByVerif: Record<string, any[]> = {};
  for (const nc of ncs) { if (!ncsByVerif[nc.verificacao_id]) ncsByVerif[nc.verificacao_id] = []; ncsByVerif[nc.verificacao_id].push(nc); }

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 1.8cm 1.5cm; }
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: white; color: #1A1A18; }
        .no-print { display: block; }
        @media print { .no-print { display: none !important; } }
        @media screen { body { background: #F7F6F3; padding: 24px 16px 64px; } .page { background: white; max-width: 794px; margin: 0 auto; padding: 40px 44px; box-shadow: 0 4px 32px rgba(0,0,0,0.10); border-radius: 6px; } }
      `}</style>

      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()} style={{ background: '#E84A1A', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          🖨 Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#F1EFE8', color: '#1A1A18', border: '1px solid #E0E0E0', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          ✕ Fechar
        </button>
      </div>

      <div className="page">
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#E84A1A', letterSpacing: '-0.5px', lineHeight: 1 }}>PrumoQ</div>
            <div style={{ fontSize: 9, color: '#9C9A93', marginTop: 2 }}>Qualidade em Obras</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Ficha de Verificação de Serviço</div>
            <div style={{ fontSize: 10, color: '#5C5B57', marginTop: 2 }}>Emitido em {emitidoEm}</div>
          </div>
        </div>
        <div style={{ borderTop: '2.5px solid #E84A1A', marginBottom: 14 }} />

        {/* Obra */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 4, background: '#F7F6F3', padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>
          {[['Obra', header.obra_nome], ['Empresa', header.empresa_nome ?? '—'], ['Município/UF', `${header.obra_municipio}, ${header.obra_uf}`],
            header.obra_eng_responsavel && ['Engenheiro', header.obra_eng_responsavel],
            header.obra_crea_cau && ['CREA/CAU', header.obra_crea_cau],
          ].filter(Boolean).map(([label, value]: any) => (
            <div key={label} style={{ marginBottom: 3 }}>
              <span style={{ color: '#9C9A93', textTransform: 'uppercase' as const, fontSize: 9, fontWeight: 600, letterSpacing: 0.4, marginRight: 4 }}>{label}:</span>
              <span style={{ fontWeight: 500, fontSize: 11 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* FVS */}
        <div style={{ background: '#FDF0EC', borderLeft: '3px solid #E84A1A', padding: '8px 12px', borderRadius: '0 8px 8px 0', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 4 }}>
            {[['Serviço (FVS)', header.fvs_subservico], ['Status', STATUS_LABELS[header.fvs_status] ?? header.fvs_status],
              ['Ambiente', `${header.ambiente_nome} (${header.ambiente_tipo === 'interno' ? 'Interno' : 'Externo'}${header.ambiente_localizacao ? ' — ' + header.ambiente_localizacao : ''})`],
              header.fvs_revisao && ['Revisão', `Rev. ${header.fvs_revisao}`],
            ].filter(Boolean).map(([label, value]: any) => (
              <div key={label} style={{ marginBottom: 3 }}>
                <span style={{ color: '#9C9A93', textTransform: 'uppercase' as const, fontSize: 9, fontWeight: 600, marginRight: 4 }}>{label}:</span>
                <span style={{ fontWeight: 500, fontSize: 11 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verificações */}
        {verificacoes.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: '#9C9A93', fontSize: 12 }}>Nenhuma verificação registrada.</div>}
        {verificacoes.map((v: any) => {
          const statusColor = v.status === 'conforme' ? '#2E7D32' : v.status === 'nao_conforme' ? '#C62828' : '#1565C0';
          const vcNcs = ncsByVerif[v.id] ?? [];
          return (
            <div key={v.id} style={{ marginBottom: 20, border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden', breakInside: 'avoid' as const }}>
              <div style={{ background: '#1A1A18', color: 'white', padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 11 }}>VERIFICAÇÃO #{v.numero_verif} — {localDate(v.data_verif)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                  {v.inspetor_nome && <span>{v.inspetor_nome}</span>}
                  <span style={{ background: statusColor, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{STATUS_LABELS[v.status] ?? v.status}</span>
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 4 }}>{v.percentual_exec}%</span>
                </div>
              </div>
              <div style={{ padding: '10px 14px' }}>
                {v.observacoes && <div style={{ marginBottom: 10, fontSize: 11, background: '#F7F6F3', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #9C9A93' }}><strong>Observações: </strong>{v.observacoes}</div>}

                {v.items.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 10 }}>
                    <thead><tr style={{ background: '#F1EFE8' }}>
                      {['#','Item de Verificação','Método','Tolerância','Res.'].map((h, i) => (
                        <th key={h} style={{ padding: '5px 8px', textAlign: i===4?'center':'left', fontWeight: 600, color: '#5C5B57', fontSize: 9, textTransform: 'uppercase' as const }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{v.items.map((item: any, idx: number) => (
                      <tr key={item.id} style={{ borderTop: '1px solid #F0EFE8', background: idx%2===0?'white':'#FAFAF8' }}>
                        <td style={{ padding: '4px 8px', color: '#9C9A93' }}>{item.ordem}</td>
                        <td style={{ padding: '4px 8px', fontWeight: 500 }}>{item.titulo}</td>
                        <td style={{ padding: '4px 8px', color: '#5C5B57' }}>{item.metodo_verif ?? '—'}</td>
                        <td style={{ padding: '4px 8px', color: '#5C5B57' }}>{item.tolerancia ?? '—'}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: 14, fontWeight: 800 }}>
                          {item.resultado==='conforme'?<span style={{color:'#2E7D32'}}>✓</span>:item.resultado==='nao_conforme'?<span style={{color:'#C62828'}}>✗</span>:<span style={{color:'#9C9A93'}}>—</span>}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}

                {vcNcs.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#C62828', textTransform: 'uppercase' as const, marginBottom: 5 }}>Não Conformidades ({vcNcs.length})</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                      <thead><tr style={{ background: '#FFEBEE' }}>
                        {['Item','Descrição','Solução Proposta','Prazo','Responsável','Status'].map(h => (
                          <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600, color: '#C62828', fontSize: 9 }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{vcNcs.map((nc: any) => (
                        <tr key={nc.id} style={{ borderTop: '1px solid #FFE0E0' }}>
                          <td style={{ padding: '4px 8px', fontSize: 10 }}>{nc.item_titulo}</td>
                          <td style={{ padding: '4px 8px', fontSize: 10 }}>{nc.descricao}</td>
                          <td style={{ padding: '4px 8px', color: '#5C5B57', fontSize: 10 }}>{nc.solucao_proposta ?? '—'}</td>
                          <td style={{ padding: '4px 8px', color: '#5C5B57', fontSize: 10 }}>{localDate(nc.data_nova_verif)}</td>
                          <td style={{ padding: '4px 8px', color: '#5C5B57', fontSize: 10 }}>{nc.responsavel_nome ?? '—'}</td>
                          <td style={{ padding: '4px 8px' }}>
                            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: nc.status==='aberta'?'#FFEBEE':'#E8F5E9', color: nc.status==='aberta'?'#C62828':'#2E7D32' }}>
                              {nc.status==='aberta'?'Aberta':nc.status==='resolvida'?'Resolvida':nc.status}
                            </span>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}

                {v.fotos.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase' as const, marginBottom: 6 }}>Fotos de Evidência</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {v.fotos.map((foto: any) => (
                        <div key={foto.id} style={{ border: '1px solid #E0E0E0', borderRadius: 4, overflow: 'hidden' }}>
                          <img src={foto.r2_url} alt={`Foto ${foto.ordem+1}`} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '2px 6px', fontSize: 9, color: '#9C9A93', background: '#F7F6F3', textAlign: 'center' }}>Foto {foto.ordem+1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {v.assinatura_url && (
                  <div style={{ borderTop: '1px solid #F0EFE8', paddingTop: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase' as const, marginBottom: 4 }}>Assinatura Digital</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                      <img src={v.assinatura_url} alt="Assinatura" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', border: '1px solid #E0E0E0', padding: 4, background: 'white', borderRadius: 4 }} />
                      <div style={{ fontSize: 10, color: '#5C5B57' }}>
                        {v.inspetor_nome && <div style={{ fontWeight: 600 }}>{v.inspetor_nome}</div>}
                        <div>Verificação #{v.numero_verif} — {localDate(v.data_verif)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {conclusao && (
          <div style={{ marginTop: 20, padding: '10px 14px', background: '#E8F5E9', borderRadius: 8, border: '1px solid #C8E6C9' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#2E7D32', textTransform: 'uppercase' as const, marginBottom: 6 }}>Conclusão da FVS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 4, fontSize: 11 }}>
              <div><span style={{ color: '#9C9A93', fontSize: 9, textTransform: 'uppercase' as const, fontWeight: 600 }}>Resultado: </span>{conclusao.resultado === 'aprovado' ? 'Aprovado' : 'Com Ressalva'}</div>
              <div><span style={{ color: '#9C9A93', fontSize: 9, textTransform: 'uppercase' as const, fontWeight: 600 }}>Percentual: </span>{conclusao.percentual_final}%</div>
              {conclusao.observacao_final && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#9C9A93', fontSize: 9, textTransform: 'uppercase' as const, fontWeight: 600 }}>Obs: </span>{conclusao.observacao_final}</div>}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #E0E0E0', marginTop: 24, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9C9A93' }}>
          <span>PrumoQ — Qualidade em Obras</span>
          <span>{header.fvs_subservico}{header.fvs_revisao ? ` · Rev. ${header.fvs_revisao}` : ''} · Emitido em {emitidoEm}</span>
        </div>
      </div>
    </>
  );
}
