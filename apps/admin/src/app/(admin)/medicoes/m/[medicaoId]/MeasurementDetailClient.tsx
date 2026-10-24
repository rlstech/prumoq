import { useState, useTransition } from 'react';
import { AlertTriangle, ArrowUpRight, Printer } from '@/components/icons';
import PageHeader from '@/components/layout/PageHeader';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import Link from '@/lib/compat/link';
import { useRouter } from '@/lib/compat/navigation';
import { approveMeasurement, cancelMeasurement, discardMeasurement, type MeasurementDetail } from '../../actions';
import { fmtDate, fmtDateTime, measurementStatus, money, num } from '../../format';

const blockLabel: Record<string, string> = { total: 'bloqueio total', parcial: 'bloqueio parcial' };
const evaluationLabel: Record<string, string> = { rascunho: 'em rascunho', concluida: 'concluída', aprovada: 'aprovada', invalidada: 'invalidada', aguardando_aprovacao: 'aguardando aprovação' };

export default function MeasurementDetailClient({ detail }: { detail: MeasurementDetail }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const { measurement: m, itens, bloqueios } = detail;
  const status = measurementStatus[m.status];

  const advance = itens.filter(i => i.tipo === 'avanco').reduce((s, i) => s + Number(i.valor_calculado ?? 0), 0);
  const rework = itens.filter(i => i.tipo === 'retrabalho').reduce((s, i) => s + Number(i.valor_calculado ?? 0), 0);
  const blocked = bloqueios.reduce((s, b) => s + Number(b.valor_bloqueado ?? 0), 0);
  const backHref = detail.contrato ? `/medicoes/contratos/${detail.contrato.id}` : '/medicoes';

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast(result.error ?? 'Falha na operação.', 'error');
        return;
      }
      toast(ok, 'success');
      if (after) after(); else router.refresh();
    });
  }

  const history = [
    { dot: 'bg-sidebar', text: <>Criada por <b>{detail.criado_por_nome ?? '—'}</b></>, when: fmtDateTime(m.created_at) },
    ...(m.aprovado_em ? [{ dot: 'bg-ok', text: <>Aprovada por <b>{detail.aprovado_por_nome ?? '—'}</b></>, when: fmtDateTime(m.aprovado_em) }] : []),
    ...(m.cancelado_em ? [{ dot: 'bg-nok', text: <>Cancelada por <b>{detail.cancelado_por_nome ?? '—'}</b>{m.motivo_cancelamento ? `: ${m.motivo_cancelamento}` : ''}</>, when: fmtDateTime(m.cancelado_em) }] : []),
  ];

  return (
    <>
      <PageHeader
        kicker={detail.contrato ? <Link href={backHref} className="hover:underline">{detail.contrato.numero} · {detail.contrato.objeto}</Link> : 'Medição'}
        title={`Medição ${m.referencia}`}
        actions={
          <>
            {m.status === 'rascunho' ? (
              <>
                <button type="button" disabled={pending} onClick={() => run(() => discardMeasurement(m.id, m.obra_id), 'Rascunho descartado.', () => router.push(backHref))} className="prumo-secondary-button">Descartar</button>
                <button type="button" disabled={pending} onClick={() => run(() => approveMeasurement(m.id, m.obra_id), 'Medição aprovada.')} className="prumo-primary-button disabled:opacity-50">Aprovar medição</button>
              </>
            ) : null}
            {m.status === 'aprovada' ? (
              <>
                <button type="button" onClick={() => { setReason(''); setCancelling(true); }} className="prumo-secondary-button text-nok">Cancelar medição</button>
                <a href={`/admin/relatorio/medicoes?medicao=${m.id}`} target="_blank" rel="noreferrer" className="prumo-primary-button">
                  <Printer size={17} /> PDF desta medição
                </a>
              </>
            ) : null}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`prumo-pill ${status?.className ?? ''}`}>{status?.label ?? m.status}</span>
          {bloqueios.length || rework > 0 ? <span className="prumo-pill bg-nok-bg text-nok">Desconto por RNC</span> : null}
          <span className="prumo-pill bg-bg-1 text-txt">{detail.equipe_nome} · {detail.obra_nome}</span>
          <span className="prumo-pill prumo-metric bg-bg-1 text-txt">{fmtDate(m.periodo_inicio)} – {fmtDate(m.periodo_fim)}</span>
          <span className="prumo-pill prumo-metric bg-bg-1 text-txt">medida em {fmtDate(m.data_medicao)}</span>
        </div>
      </PageHeader>

      {m.status === 'rascunho' && detail.equipe_terceirizada && detail.avaliacao?.status !== 'aprovada' ? (
        <p className="mb-4 rounded-xl bg-warn-bg px-5 py-3.5 text-sm text-warn">
          Empreiteiro terceirizado precisa de avaliação aprovada antes de aprovar a medição.{' '}
          {detail.avaliacao ? `Avaliação ${evaluationLabel[detail.avaliacao.status] ?? detail.avaliacao.status}. ` : 'Nenhuma avaliação ligada a esta medição. '}
          <Link href="/avaliacoes" className="font-bold underline">Abrir avaliações</Link>
        </p>
      ) : null}

      <section aria-label="Resumo da medição" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="on-brand flex flex-col gap-2 rounded-xl bg-sidebar p-5 text-white">
          <span className="text-[13px] text-on-brand">Valor da medição</span>
          <span className="prumo-metric text-[28px] font-bold leading-none">{money(advance + rework)}</span>
        </div>
        <Metric label="Avanço medido" value={money(advance)} tone="text-ok" />
        <Metric label="Retrabalho" value={money(rework)} tone={rework > 0 ? 'text-nok' : ''} />
        <Metric label="Fica fora por RNC" value={money(blocked)} tone={blocked > 0 ? 'text-nok' : ''} />
      </section>

      <section aria-label="Itens" className="mt-5 overflow-hidden rounded-xl bg-bg-1">
        <h2 className="px-5 pb-2 pt-5 text-lg font-extrabold text-txt">Itens medidos</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="prumo-th px-5 py-2.5">Serviço</th>
                <th className="prumo-th px-3 py-2.5 text-right">Anterior → atual</th>
                <th className="prumo-th px-3 py-2.5 text-right">Nesta medição</th>
                <th className="prumo-th px-3 py-2.5 text-right">Preço</th>
                <th className="prumo-th px-5 py-2.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.id} className="border-t border-brd-0 align-top">
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`prumo-pill ${item.tipo === 'avanco' ? 'bg-pg-bg text-pg' : 'bg-nok-bg text-nok'}`}>{item.tipo === 'avanco' ? 'Avanço' : 'Retrabalho'}</span>
                        <b className="text-txt">{item.servico}</b>
                        {item.etapa_nome ? <span className="text-[13px] text-txt-2">· {item.etapa_nome}</span> : null}
                      </span>
                      {item.ambiente ? <span className="text-[13px] text-txt-2">{item.ambiente}</span> : null}
                      {item.tipo === 'retrabalho' && item.nc_id ? (
                        <Link href={`/nc/${item.nc_id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-nok hover:underline">
                          <AlertTriangle size={13} /> NC #{item.nc_numero_ocorrencia} · {item.nc_descricao || 'sem descrição'}
                        </Link>
                      ) : null}
                      {item.liberacoes.length ? (
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {item.liberacoes.map(l => (
                            <li key={l.avanco_id} className="prumo-metric text-xs text-txt-2">
                              FVS aprovada em {fmtDateTime(l.data_aprovacao)} · {num(l.aprovado_anterior)} → {num(l.aprovado_atual)} · usado {num(l.quantidade_utilizada)} {item.unidade}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </td>
                  <td className="prumo-metric px-3 py-3.5 text-right text-[13px]">
                    {item.tipo === 'avanco' ? `${num(item.quantidade_anterior)} → ${num(item.quantidade_atual)} ${item.unidade}` : '—'}
                  </td>
                  <td className="prumo-metric px-3 py-3.5 text-right font-bold">{item.tipo === 'avanco' ? `${num(item.quantidade_periodo)} ${item.unidade}` : '—'}</td>
                  <td className="prumo-metric px-3 py-3.5 text-right text-[13px]">{item.preco_unitario == null ? '—' : money(item.preco_unitario)}</td>
                  <td className="prumo-metric px-5 py-3.5 text-right font-bold">{money(item.valor_calculado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-brd-0 bg-bg-hover font-bold">
                <td className="px-5 py-3.5" colSpan={4}>Total da medição</td>
                <td className="prumo-metric px-5 py-3.5 text-right">{money(advance + rework)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-label="Descontos por RNC" className="rounded-xl bg-bg-1 p-5">
          <h2 className="text-lg font-extrabold text-txt">Descontos por RNC</h2>
          {bloqueios.length ? (
            <div className="mt-3 flex flex-col gap-2">
              {bloqueios.map(b => (
                <Link key={b.nc_id} href={`/nc/${b.nc_id}`} className="flex items-start justify-between gap-3 rounded-lg bg-nok-bg p-4 transition-colors hover:bg-nok-bg/70">
                  <span className="flex min-w-0 flex-col gap-1">
                    <b className="text-nok">NC #{b.numero_ocorrencia} · {blockLabel[b.bloqueio_medicao ?? ''] ?? b.bloqueio_medicao}</b>
                    <span className="line-clamp-2 text-[13px] text-txt">{b.descricao}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="prumo-metric font-bold text-nok">{money(b.valor_bloqueado)}</span>
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-txt">Abrir <ArrowUpRight size={12} /></span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-txt-2">Nenhuma NC bloqueando as quantidades desta medição.</p>
          )}
        </section>
        <section aria-label="Histórico" className="rounded-xl bg-bg-1 p-5">
          <h2 className="text-lg font-extrabold text-txt">Histórico</h2>
          <ol className="mt-3 flex flex-col gap-3 text-sm">
            {history.map((h, index) => (
              <li key={index} className="flex gap-3">
                <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${h.dot}`} />
                <span>{h.text} <span className="prumo-metric text-[13px] text-txt-2">{h.when}</span></span>
              </li>
            ))}
            {m.observacao ? (
              <li className="flex gap-3 text-txt-2">
                <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brd-1" />
                <span>Observação: {m.observacao}</span>
              </li>
            ) : null}
          </ol>
        </section>
      </div>

      <Modal
        isOpen={cancelling}
        onClose={() => setCancelling(false)}
        title={`Cancelar ${m.referencia}`}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setCancelling(false)} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">Voltar</button>
            <button
              type="button"
              disabled={pending || reason.trim().length < 3}
              onClick={() => run(() => cancelMeasurement(m.id, m.obra_id, reason), 'Medição cancelada e saldo restaurado.', () => { setCancelling(false); router.refresh(); })}
              className="inline-flex h-11 items-center rounded-full bg-nok px-5 text-sm font-bold text-white hover:bg-nok/90 disabled:opacity-50"
            >
              Confirmar cancelamento
            </button>
          </>
        }
      >
        <p className="text-sm text-txt-2">As quantidades voltam a ficar liberadas para medir. O histórico continua visível.</p>
        <label className="mt-4 flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Justificativa
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className="prumo-field py-2.5" />
        </label>
      </Modal>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-bg-1 p-5">
      <span className="text-[13px] text-txt-2">{label}</span>
      <span className={`prumo-metric text-[24px] font-bold leading-none ${tone || 'text-txt'}`}>{value}</span>
    </div>
  );
}
