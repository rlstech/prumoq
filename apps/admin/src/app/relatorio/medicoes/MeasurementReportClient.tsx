import { Fragment } from 'react';
import type { MeasurementReport } from '@/lib/reports/medicoes';
import { fmtDate, fmtDateTime, num } from '@/app/(admin)/medicoes/format';

// Valores em reais sem o símbolo (as colunas já dizem "R$").
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRINT_CSS = `
  .mr { font-family: 'Figtree Variable', Figtree, Arial, sans-serif; color: #1C1F22; font-size: 12.5px; line-height: 1.45; }
  .mr .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .mr h1 { margin: 4px 0 2px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
  .mr h2 { margin: 0; font-size: 15px; font-weight: 800; }
  .mr table { width: 100%; border-collapse: collapse; }
  .mr th { text-align: left; font-weight: 700; color: #4C5157; padding: 5px 7px; border-bottom: 1px solid #CFCBC3; }
  .mr td { padding: 5px 7px; border-bottom: 1px solid #ECEAE6; vertical-align: top; }
  .mr .num { text-align: right; white-space: nowrap; }
  .mr .dark th { background: #1C1F22; color: #FFFFFF; border: none; }
  .mr .total td { background: #ECEAE6; font-weight: 800; border: none; }
  .mr .contract { margin-top: 22px; break-inside: auto; }
  .mr .contract-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; border-bottom: 1.5px solid #1C1F22; padding-bottom: 5px; margin-bottom: 8px; }
  .mr .measure { margin-top: 10px; border: 1.2px solid #CFCBC3; border-radius: 8px; padding: 9px 11px; break-inside: avoid; }
  .mr .measure-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
  .mr .muted { color: #4C5157; }
  .mr .nok { color: #A8221A; }
  .mr .brand { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 20px; letter-spacing: 0.04em; }
  .mr .brand span { background: #FFC21A; padding: 0 3px; border-radius: 3px; }
  .no-print { display: flex; }
  @page { size: A4 portrait; margin: 14mm 12mm; }
  @media print {
    .no-print { display: none !important; }
    html, body { background: white !important; }
  }
  @media screen {
    body { background: #ECEAE6; }
    .sheet { background: #FFFFFF; max-width: 210mm; margin: 24px auto 64px; padding: 16mm 14mm; border-radius: 12px; box-sizing: border-box; }
  }
`;

export default function MeasurementReportClient({ report }: { report: MeasurementReport }) {
  const totals = report.contratos.reduce((acc, c) => ({ contratado: acc.contratado + c.contratado, medido: acc.medido + c.medido }), { contratado: 0, medido: 0 });
  const single = report.boletim;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="no-print fixed right-4 top-4 z-10 gap-2 rounded-full bg-bg-1 p-1.5 shadow-float">
        <button type="button" onClick={() => window.print()} className="prumo-primary-button h-10">Imprimir / salvar PDF</button>
        <button type="button" onClick={() => window.close()} className="prumo-secondary-button h-10 bg-bg-0 hover:bg-bg-2">Fechar</button>
      </div>

      <div className="sheet mr">
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, borderBottom: '3px solid #1C1F22', paddingBottom: 12 }}>
          <div>
            <div className="brand">PRUMO<span>Q</span></div>
            <h1>{single ? 'Boletim de medição' : 'Relatório de medições'}</h1>
            <div className="muted">{report.escopo} · só medições aprovadas</div>
          </div>
          <div className="muted" style={{ textAlign: 'right' }}>
            Emitido em<br />
            <b className="mono" style={{ color: '#1C1F22' }}>{fmtDateTime(report.emitidoEm)}</b>
          </div>
        </header>

        {!report.contratos.length ? <p className="muted" style={{ marginTop: 24 }}>Nenhum contrato encontrado.</p> : null}

        {report.contratos.length > 1 ? (
          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 8 }}>Resumo por contrato</h2>
            <table className="dark">
              <thead>
                <tr><th>Contrato</th><th>Empreiteiro · obra</th><th className="num">Contratado (R$)</th><th className="num">Medido (R$)</th><th className="num">Saldo (R$)</th><th className="num">%</th></tr>
              </thead>
              <tbody>
                {report.contratos.map(c => (
                  <tr key={c.id}>
                    <td><b>{c.numero}</b> {c.objeto}</td>
                    <td>{c.equipe}<div className="muted">{c.obra}</div></td>
                    <td className="num mono">{brl(c.contratado)}</td>
                    <td className="num mono">{brl(c.medido)}</td>
                    <td className="num mono">{brl(Math.max(c.contratado - c.medido, 0))}</td>
                    <td className="num mono">{c.contratado > 0 ? Math.round((c.medido / c.contratado) * 100) : 0}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={2}>Total</td>
                  <td className="num mono">{brl(totals.contratado)}</td>
                  <td className="num mono">{brl(totals.medido)}</td>
                  <td className="num mono">{brl(Math.max(totals.contratado - totals.medido, 0))}</td>
                  <td className="num mono">{totals.contratado > 0 ? Math.round((totals.medido / totals.contratado) * 100) : 0}</td>
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        {report.contratos.map(c => (
          <section key={c.id} className="contract">
            <div className="contract-head">
              <h2>{c.numero} · {c.objeto}</h2>
              <span className="muted">{c.equipe} · {c.obra} · {fmtDate(c.inicio)} a {c.fim ? fmtDate(c.fim) : 'sem término'}{c.status === 'encerrado' ? ' · encerrado' : ''}</span>
            </div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Contratado <b className="mono" style={{ color: '#1C1F22' }}>R$ {brl(c.contratado)}</b> · medido <b className="mono" style={{ color: '#1C1F22' }}>R$ {brl(c.medido)}</b> · saldo <b className="mono" style={{ color: '#1C1F22' }}>R$ {brl(Math.max(c.contratado - c.medido, 0))}</b>
            </div>

            {c.aditivos.length ? (
              <div className="muted" style={{ marginBottom: 8 }}>
                Aditivos:{' '}
                {c.aditivos.map((ad, index) => (
                  <span key={ad.numero}>
                    {index ? ' · ' : ''}<b style={{ color: '#1C1F22' }}>AD-{String(ad.numero).padStart(2, '0')}</b> {fmtDate(ad.data)} ({ad.descricao}) <span className="mono">R$ {brl(ad.valorAnterior)} → R$ {brl(ad.valorNovo)}</span>
                  </span>
                ))}
              </div>
            ) : null}

            {c.medicoes.length ? (
              <>
                {!single ? (
                  <table>
                    <thead><tr><th>Medição</th><th>Período</th><th>Aprovada em</th><th className="num">Valor (R$)</th><th className="num">Acumulado (R$)</th></tr></thead>
                    <tbody>
                      {c.medicoes.map(m => (
                        <tr key={m.id}>
                          <td><b>{m.referencia}</b></td>
                          <td className="mono">{fmtDate(m.periodoInicio)} – {fmtDate(m.periodoFim)}</td>
                          <td className="mono">{m.aprovadoEm ? fmtDate(m.aprovadoEm) : '—'}</td>
                          <td className="num mono">{brl(m.valor)}</td>
                          <td className="num mono">{brl(m.acumulado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                {c.medicoes.map(m => (
                  <div key={m.id} className="measure">
                    <div className="measure-head">
                      <b>{m.referencia} · itens</b>
                      <span className="muted">
                        Período {fmtDate(m.periodoInicio)} a {fmtDate(m.periodoFim)} · aprovada{m.aprovadoPor ? ` por ${m.aprovadoPor}` : ''}{m.aprovadoEm ? ` em ${fmtDate(m.aprovadoEm)}` : ''}
                      </span>
                    </div>
                    <table>
                      <thead><tr><th>Serviço</th><th className="num">Anterior → atual</th><th className="num">Período</th><th className="num">Preço (R$)</th><th className="num">Valor (R$)</th></tr></thead>
                      <tbody>
                        {m.itens.map(i => (
                          <Fragment key={i.id}>
                            <tr>
                              <td>
                                {i.tipo === 'retrabalho' ? <b className="nok">Retrabalho · </b> : null}
                                {i.ambiente ? `${i.ambiente} › ` : ''}{i.servico}{i.etapa ? ` · ${i.etapa}` : ''}
                                {i.nc ? <div className="nok">{i.nc}</div> : null}
                              </td>
                              <td className="num mono">{i.tipo === 'avanco' ? `${num(i.anterior)} → ${num(i.atual)} ${i.unidade}` : '—'}</td>
                              <td className="num mono">{i.tipo === 'avanco' ? `${num(i.periodo)} ${i.unidade}` : '—'}</td>
                              <td className="num mono">{i.preco == null ? '—' : brl(i.preco)}</td>
                              <td className="num mono">{brl(i.valor)}</td>
                            </tr>
                          </Fragment>
                        ))}
                        <tr className="total"><td colSpan={4}>Total da medição</td><td className="num mono">{brl(m.valor)}</td></tr>
                      </tbody>
                    </table>
                    {m.observacao ? <div className="muted" style={{ marginTop: 5 }}>Observação: {m.observacao}</div> : null}
                    <div className="muted" style={{ marginTop: 5 }}>Acumulado do contrato após esta medição: <b className="mono">R$ {brl(m.acumulado)}</b></div>
                  </div>
                ))}
              </>
            ) : (
              <p className="muted">Nenhuma medição aprovada neste contrato.</p>
            )}
          </section>
        ))}

        {single ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 56 }}>
            {['Responsável pela obra', 'Empreiteiro'].map(label => (
              <div key={label} style={{ borderTop: '1px solid #1C1F22', paddingTop: 6, textAlign: 'center' }} className="muted">{label}</div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
