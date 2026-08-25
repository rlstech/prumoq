'use client';

import { AlertTriangle, ArrowUpRight, FileText, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import type { MeasurementDetail } from './actions';

const money = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n: number | null | undefined, digits = 4) => Number(n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('pt-BR') : '—');

const statusLabel: Record<string, string> = { rascunho: 'Rascunho', aprovada: 'Aprovada', cancelada: 'Cancelada' };
const statusClass: Record<string, string> = {
  rascunho: 'bg-warn-bg text-warn',
  aprovada: 'bg-ok-bg text-ok',
  cancelada: 'bg-nok-bg text-nok',
};
const blockLabel: Record<string, string> = { nao: 'Não bloqueia', total: 'Total', parcial: 'Parcial' };

export default function MeasurementDetailModal({ detail, onClose }: { detail: MeasurementDetail; onClose: () => void }) {
  const { measurement, itens, bloqueios, saldos } = detail;
  const total = itens.reduce((sum, item) => sum + Number(item.valor_calculado ?? 0), 0);
  const avancoTotal = itens.filter(item => item.tipo === 'avanco').reduce((sum, item) => sum + Number(item.valor_calculado ?? 0), 0);
  const retrabalhoTotal = itens.filter(item => item.tipo === 'retrabalho').reduce((sum, item) => sum + Number(item.valor_calculado ?? 0), 0);
  const bloqueadoTotal = bloqueios.reduce((sum, nc) => sum + Number(nc.valor_bloqueado ?? 0), 0);
  const saldoBloqueado = saldos.reduce((sum, row) => sum + Number(row.valor_bloqueado ?? 0), 0);
  const hasRncDiscount = bloqueios.length > 0 || retrabalhoTotal > 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Medição ${measurement.referencia}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-txt">{detail.obra_nome}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass[measurement.status] ?? 'bg-bg-2 text-txt-2'}`}>
                {statusLabel[measurement.status] ?? measurement.status}
              </span>
              {hasRncDiscount ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-nok-bg px-2.5 py-1 text-[11px] font-semibold text-nok">
                  <ShieldOff size={12} /> Desconto por RNC
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-txt-2">
              {detail.equipe_nome} · Período {fmtDate(measurement.periodo_inicio)} a {fmtDate(measurement.periodo_fim)} · Medição em {fmtDate(measurement.data_medicao)}
            </p>
          </div>
          <div className="rounded-xl border border-brd-0 bg-bg-0 px-4 py-3 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-txt-3">Valor total</div>
            <div className="mt-1 text-xl font-bold text-txt">{money(total)}</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Avanço medido" value={money(avancoTotal)} tone="ok" />
          <Metric label="Retrabalho" value={money(retrabalhoTotal)} tone={retrabalhoTotal > 0 ? 'nok' : undefined} />
          <Metric label="Bloqueado por RNC" value={money(bloqueadoTotal || saldoBloqueado)} tone={(bloqueadoTotal || saldoBloqueado) > 0 ? 'nok' : undefined} />
          <Metric label="Itens" value={String(itens.length)} />
        </div>

        {/* Metadados de aprovação */}
        <div className="grid gap-2 rounded-xl border border-brd-0 bg-bg-0 p-4 text-xs text-txt-2 md:grid-cols-3">
          <div>Criado por <b className="text-txt">{detail.criado_por_nome ?? '—'}</b> em {fmtDateTime(measurement.created_at)}</div>
          {measurement.status === 'aprovada' ? (
            <div>Aprovado por <b className="text-txt">{detail.aprovado_por_nome ?? '—'}</b> em {fmtDateTime(measurement.aprovado_em)}</div>
          ) : (
            <div>Aprovado por <b className="text-txt">{detail.aprovado_por_nome ?? '—'}</b>{measurement.aprovado_em ? ` em ${fmtDateTime(measurement.aprovado_em)}` : ''}</div>
          )}
          {measurement.status === 'cancelada' ? (
            <div>Cancelado por <b className="text-txt">{detail.cancelado_por_nome ?? '—'}</b> em {fmtDateTime(measurement.cancelado_em)}</div>
          ) : null}
          {measurement.observacao ? (
            <div className="md:col-span-3">Observação: <b className="text-txt">{measurement.observacao}</b></div>
          ) : null}
          {measurement.status === 'cancelada' && measurement.motivo_cancelamento ? (
            <div className="md:col-span-3">Motivo do cancelamento: <b className="text-txt">{measurement.motivo_cancelamento}</b></div>
          ) : null}
        </div>

        {/* Itens */}
        <section className="overflow-hidden rounded-xl border border-brd-0">
          <div className="border-b border-brd-0 bg-bg-0 px-4 py-3 text-sm font-semibold text-txt">Itens da medição</div>
          {itens.length ? (
            <div className="divide-y divide-brd-0">
              {itens.map(item => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.tipo === 'avanco' ? 'bg-pg-bg text-pg' : 'bg-nok-bg text-nok'}`}>
                          {item.tipo === 'avanco' ? 'Avanço' : 'Retrabalho'}
                        </span>
                        <b className="truncate text-txt">{item.servico}</b>
                        {item.etapa_nome ? <span className="text-xs text-txt-3">· {item.etapa_nome}</span> : null}
                      </div>
                      {item.tipo === 'retrabalho' && item.nc_id ? (
                        <Link href={`/nc/${item.nc_id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-nok hover:underline">
                          <AlertTriangle size={12} /> NC #{item.nc_numero_ocorrencia} · {item.nc_descricao || 'sem descrição'}
                        </Link>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-xs text-txt-2">
                      {item.tipo === 'avanco'
                        ? `${num(item.quantidade_anterior)} → ${num(item.quantidade_atual)} ${item.unidade} · período ${num(item.quantidade_periodo)}`
                        : ''}
                      {' '}· {money(item.valor_calculado)}
                      {item.preco_unitario != null && item.tipo === 'avanco' ? <span className="block text-txt-3">preço unit. {money(item.preco_unitario)}</span> : null}
                    </div>
                  </div>

                  {item.liberacoes.length ? (
                    <div className="mt-2 rounded-lg bg-bg-0 p-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-txt-3">
                        <FileText size={11} /> Liberações consumidas
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {item.liberacoes.map(rel => (
                          <div key={rel.avanco_id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-txt-2">
                            <span>
                              Aprovado {num(rel.aprovado_anterior)} → {num(rel.aprovado_atual)} {item.unidade}
                            </span>
                            <span>
                              {num(rel.quantidade_utilizada)} {item.unidade} · {fmtDateTime(rel.data_aprovacao)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-txt-3">Nenhum item registrado.</div>
          )}
        </section>

        {/* Desconto por RNC */}
        <section className="overflow-hidden rounded-xl border border-brd-0">
          <div className="flex items-center justify-between border-b border-brd-0 bg-bg-0 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-txt">
              <ShieldOff size={15} className={bloqueios.length ? 'text-nok' : 'text-txt-3'} />
              Desconto por RNC
            </div>
            <span className={`text-xs font-semibold ${(bloqueadoTotal || saldoBloqueado) > 0 ? 'text-nok' : 'text-ok'}`}>
              {(bloqueadoTotal || saldoBloqueado) > 0 ? money(bloqueadoTotal || saldoBloqueado) : 'Sem bloqueio ativo'}
            </span>
          </div>
          {bloqueios.length ? (
            <div className="divide-y divide-brd-0">
              {bloqueios.map(nc => (
                <Link key={nc.nc_id} href={`/nc/${nc.nc_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <b className="text-txt">NC #{nc.numero_ocorrencia}</b>
                      <span className="text-[10px] font-semibold uppercase text-txt-3">{blockLabel[nc.bloqueio_medicao ?? 'nao'] ?? nc.bloqueio_medicao}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${nc.status === 'aberta' ? 'bg-nok-bg text-nok' : 'bg-warn-bg text-warn'}`}>
                        {nc.status === 'aberta' ? 'Aberta' : 'Em correção'}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-txt-2">{nc.descricao}</p>
                    {nc.situacao_financeira ? <p className="mt-0.5 text-[11px] text-txt-3">Situação: {nc.situacao_financeira.replaceAll('_', ' ')}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-nok">{money(nc.valor_bloqueado)}</div>
                    <div className="inline-flex items-center gap-0.5 text-[11px] text-brand">
                      Abrir <ArrowUpRight size={11} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-txt-3">
              Nenhuma RNC com bloqueio ativo nos vínculos desta medição.
            </div>
          )}
          {saldos.some(row => Number(row.bloqueado ?? 0) > 0) ? (
            <div className="border-t border-brd-0 bg-bg-0 px-4 py-2.5">
              {saldos.filter(row => Number(row.bloqueado ?? 0) > 0).map(row => (
                <div key={row.vinculacao_id ?? ''} className="flex flex-wrap justify-between gap-2 text-xs text-txt-2">
                  <span>Vínculo bloqueado: aprovado {num(row.aprovado)} · medido {num(row.medido)} · bloqueado {num(row.bloqueado)}</span>
                  <span className="font-semibold text-nok">{money(row.valor_bloqueado)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'nok' }) {
  return (
    <div className="rounded-xl border border-brd-0 bg-bg-1 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-txt-3">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === 'ok' ? 'text-ok' : tone === 'nok' ? 'text-nok' : 'text-txt'}`}>{value}</div>
    </div>
  );
}
