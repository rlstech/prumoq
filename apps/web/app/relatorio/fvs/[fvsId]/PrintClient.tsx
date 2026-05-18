'use client';

import { useEffect } from 'react';

interface Header {
  obra_nome: string; obra_municipio: string; obra_uf: string; obra_endereco: string | null;
  obra_eng_responsavel: string | null; obra_crea_cau: string | null; empresa_nome: string | null;
  ambiente_nome: string; ambiente_tipo: string; ambiente_localizacao: string | null;
  fvs_subservico: string; fvs_status: string; fvs_revisao: string | null; fvs_concluida_em: string | null;
}
interface VerifData {
  id: string; numero_verif: number; data_verif: string; status: string;
  observacoes: string | null; assinatura_url: string | null; percentual_exec: number;
  inspetor_nome: string | null;
  items: { id: string; ordem: number; titulo: string; metodo_verif: string | null; tolerancia: string | null; resultado: string }[];
  fotos: { id: string; r2_url: string; ordem: number }[];
}
interface NcData {
  id: string; verificacao_id: string; descricao: string; solucao_proposta: string | null;
  data_nova_verif: string | null; status: string; item_titulo: string; responsavel_nome: string | null;
}
interface Props {
  header: Header; verificacoes: VerifData[]; ncs: NcData[];
  conclusao: any | null; emitidoEm: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente', em_andamento: 'Em Andamento', conforme: 'Conforme',
  nao_conforme: 'Não Conforme', concluida: 'Concluída',
  concluida_ressalva: 'Concluída c/ Ressalva', em_revisao: 'Em Revisão',
};

function localDate(str: string | null) {
  if (!str) return '—';
  return new Date(str.length === 10 ? str + 'T00:00:00' : str).toLocaleDateString('pt-BR');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 3 }}>
      <span style={{ color: '#9C9A93', textTransform: 'uppercase', fontSize: 9, fontWeight: 600, letterSpacing: 0.4, marginRight: 4 }}>{label}:</span>
      <span style={{ fontWeight: 500, fontSize: 11 }}>{value}</span>
    </div>
  );
}

function Resultado({ r }: { r: string }) {
  if (r === 'conforme') return <span style={{ color: '#2E7D32', fontWeight: 800, fontSize: 14 }}>✓</span>;
  if (r === 'nao_conforme') return <span style={{ color: '#C62828', fontWeight: 800, fontSize: 14 }}>✗</span>;
  return <span style={{ color: '#9C9A93', fontSize: 12 }}>—</span>;
}

function VerifSection({ verif, ncs }: { verif: VerifData; ncs: NcData[] }) {
  const statusColor = verif.status === 'conforme' ? '#2E7D32' : verif.status === 'nao_conforme' ? '#C62828' : '#1565C0';

  return (
    <div style={{ marginBottom: 20, border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden', breakInside: 'avoid' }}>
      {/* Header da verificação */}
      <div style={{ background: '#1A1A18', color: 'white', padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 11 }}>VERIFICAÇÃO #{verif.numero_verif} — {localDate(verif.data_verif)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10 }}>
          {verif.inspetor_nome && <span>{verif.inspetor_nome}</span>}
          <span style={{ background: statusColor, padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 10 }}>
            {STATUS_LABELS[verif.status] ?? verif.status}
          </span>
          <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 4 }}>{verif.percentual_exec}%</span>
        </div>
      </div>

      <div style={{ padding: '10px 14px' }}>
        {/* Observações */}
        {verif.observacoes && (
          <div style={{ marginBottom: 10, fontSize: 11, background: '#F7F6F3', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #9C9A93' }}>
            <span style={{ fontWeight: 600, color: '#5C5B57' }}>Observações: </span>
            <span style={{ color: '#1A1A18' }}>{verif.observacoes}</span>
          </div>
        )}

        {/* Tabela de itens */}
        {verif.items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 10 }}>
            <thead>
              <tr style={{ background: '#F1EFE8' }}>
                {(['#', 'Item de Verificação', 'Método', 'Tolerância', 'Res.'] as const).map((h, i) => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: i === 4 ? 'center' : 'left', fontWeight: 600, color: '#5C5B57', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3, width: i === 0 ? '4%' : i === 1 ? '36%' : i === 2 ? '30%' : i === 3 ? '20%' : '10%' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {verif.items.map((item, i) => (
                <tr key={item.id} style={{ borderTop: '1px solid #F0EFE8', background: i % 2 === 0 ? 'white' : '#FAFAF8' }}>
                  <td style={{ padding: '4px 8px', color: '#9C9A93' }}>{item.ordem}</td>
                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>{item.titulo}</td>
                  <td style={{ padding: '4px 8px', color: '#5C5B57' }}>{item.metodo_verif ?? '—'}</td>
                  <td style={{ padding: '4px 8px', color: '#5C5B57' }}>{item.tolerancia ?? '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}><Resultado r={item.resultado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Não Conformidades */}
        {ncs.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#C62828', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Não Conformidades ({ncs.length})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#FFEBEE' }}>
                  {(['Item', 'Descrição', 'Solução Proposta', 'Prazo', 'Responsável', 'Status']).map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600, color: '#C62828', fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ncs.map(nc => (
                  <tr key={nc.id} style={{ borderTop: '1px solid #FFE0E0' }}>
                    <td style={{ padding: '4px 8px', fontSize: 10 }}>{nc.item_titulo}</td>
                    <td style={{ padding: '4px 8px', fontSize: 10 }}>{nc.descricao}</td>
                    <td style={{ padding: '4px 8px', color: '#5C5B57', fontSize: 10 }}>{nc.solucao_proposta ?? '—'}</td>
                    <td style={{ padding: '4px 8px', color: '#5C5B57', fontSize: 10 }}>{localDate(nc.data_nova_verif)}</td>
                    <td style={{ padding: '4px 8px', color: '#5C5B57', fontSize: 10 }}>{nc.responsavel_nome ?? '—'}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: nc.status === 'aberta' ? '#FFEBEE' : '#E8F5E9', color: nc.status === 'aberta' ? '#C62828' : '#2E7D32' }}>
                        {nc.status === 'aberta' ? 'Aberta' : nc.status === 'resolvida' ? 'Resolvida' : nc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fotos */}
        {verif.fotos.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Fotos de Evidência</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {verif.fotos.map(foto => (
                <div key={foto.id} style={{ border: '1px solid #E0E0E0', borderRadius: 4, overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto.r2_url} alt={`Foto ${foto.ordem + 1}`} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '2px 6px', fontSize: 9, color: '#9C9A93', background: '#F7F6F3', textAlign: 'center' }}>Foto {foto.ordem + 1}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assinatura */}
        {verif.assinatura_url && (
          <div style={{ borderTop: '1px solid #F0EFE8', paddingTop: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Assinatura Digital</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={verif.assinatura_url} alt="Assinatura" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', border: '1px solid #E0E0E0', padding: 4, background: 'white', borderRadius: 4 }} />
              <div style={{ fontSize: 10, color: '#5C5B57' }}>
                {verif.inspetor_nome && <div style={{ fontWeight: 600 }}>{verif.inspetor_nome}</div>}
                <div>Verificação #{verif.numero_verif} — {localDate(verif.data_verif)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PrintClient({ header, verificacoes, ncs, conclusao, emitidoEm }: Props) {
  useEffect(() => {
    const imgs = Array.from(document.images);
    if (imgs.length === 0) { window.print(); return; }
    let done = 0;
    const tryPrint = () => { done++; if (done >= imgs.length) window.print(); };
    imgs.forEach(img => {
      if (img.complete) tryPrint();
      else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
  }, []);

  const ncsByVerif: Record<string, NcData[]> = {};
  for (const nc of ncs) {
    if (!ncsByVerif[nc.verificacao_id]) ncsByVerif[nc.verificacao_id] = [];
    ncsByVerif[nc.verificacao_id].push(nc);
  }

  const ambienteDesc = [
    header.ambiente_nome,
    `(${header.ambiente_tipo === 'interno' ? 'Interno' : 'Externo'}${header.ambiente_localizacao ? ' — ' + header.ambiente_localizacao : ''})`,
  ].join(' ');

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 1.8cm 1.5cm; }
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: white; color: #1A1A18; }
        .no-print { display: block; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white; }
        }
        @media screen {
          body { background: #F7F6F3; padding: 32px 16px 64px; }
          .page { background: white; max-width: 794px; margin: 0 auto; padding: 40px 44px; box-shadow: 0 4px 32px rgba(0,0,0,0.10); border-radius: 6px; }
        }
      `}</style>

      {/* Toolbar (tela apenas) */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()} style={{ background: '#E84A1A', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          🖨 Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#F1EFE8', color: '#1A1A18', border: '1px solid #E0E0E0', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          ✕ Fechar
        </button>
      </div>

      <div className="page">

        {/* ── CABEÇALHO ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#E84A1A', letterSpacing: '-0.5px', lineHeight: 1 }}>PrumoQ</div>
            <div style={{ fontSize: 9, color: '#9C9A93', marginTop: 2, letterSpacing: 0.3 }}>Qualidade em Obras</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#1A1A18' }}>Ficha de Verificação de Serviço</div>
            <div style={{ fontSize: 10, color: '#5C5B57', marginTop: 2 }}>Emitido em {emitidoEm}</div>
          </div>
        </div>
        <div style={{ borderTop: '2.5px solid #E84A1A', marginBottom: 14 }} />

        {/* ── DADOS DA OBRA ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 4, background: '#F7F6F3', padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>
          <InfoRow label="Obra" value={header.obra_nome} />
          <InfoRow label="Empresa" value={header.empresa_nome ?? '—'} />
          <InfoRow label="Município/UF" value={`${header.obra_municipio}, ${header.obra_uf}`} />
          {header.obra_endereco && <InfoRow label="Endereço" value={header.obra_endereco} />}
          {header.obra_eng_responsavel && <InfoRow label="Engenheiro Resp." value={header.obra_eng_responsavel} />}
          {header.obra_crea_cau && <InfoRow label="CREA/CAU" value={header.obra_crea_cau} />}
        </div>

        {/* ── DADOS DA FVS ──────────────────────────────────── */}
        <div style={{ background: '#FDF0EC', borderLeft: '3px solid #E84A1A', padding: '8px 12px', borderRadius: '0 8px 8px 0', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 4 }}>
            <InfoRow label="Serviço (FVS)" value={header.fvs_subservico} />
            <InfoRow label="Status" value={STATUS_LABELS[header.fvs_status] ?? header.fvs_status} />
            <InfoRow label="Ambiente" value={ambienteDesc} />
            {header.fvs_revisao && <InfoRow label="Revisão" value={`Rev. ${header.fvs_revisao}`} />}
            {header.fvs_concluida_em && <InfoRow label="Concluída em" value={localDate(header.fvs_concluida_em)} />}
          </div>
        </div>

        {/* ── VERIFICAÇÕES ──────────────────────────────────── */}
        {verificacoes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9C9A93', fontSize: 12 }}>
            Nenhuma verificação registrada para esta FVS.
          </div>
        )}
        {verificacoes.map(v => (
          <VerifSection key={v.id} verif={v} ncs={ncsByVerif[v.id] ?? []} />
        ))}

        {/* ── CONCLUSÃO ─────────────────────────────────────── */}
        {conclusao && (
          <div style={{ marginTop: 20, padding: '10px 14px', background: '#E8F5E9', borderRadius: 8, border: '1px solid #C8E6C9' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Conclusão da FVS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 4 }}>
              <InfoRow label="Resultado" value={conclusao.resultado === 'aprovado' ? 'Aprovado' : 'Com Ressalva'} />
              <InfoRow label="Percentual Final" value={`${conclusao.percentual_final}%`} />
              {conclusao.observacao_final && <InfoRow label="Observação" value={conclusao.observacao_final} />}
            </div>
          </div>
        )}

        {/* ── RODAPÉ ────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #E0E0E0', marginTop: 24, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9C9A93' }}>
          <span>PrumoQ — Qualidade em Obras</span>
          <span>
            {header.fvs_subservico}
            {header.fvs_revisao ? ` · Rev. ${header.fvs_revisao}` : ''}
            {' · '}Emitido em {emitidoEm}
          </span>
        </div>

      </div>
    </>
  );
}
