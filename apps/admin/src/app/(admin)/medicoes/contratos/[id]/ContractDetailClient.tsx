import { useState, useTransition } from 'react';
import { FileText, Plus, Printer } from '@/components/icons';
import PageHeader from '@/components/layout/PageHeader';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ProgressBar from '@/components/ui/ProgressBar';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import Link from '@/lib/compat/link';
import { useRouter, useSearchParams } from '@/lib/compat/navigation';
import type { Database } from '@prumoq/shared';
import { approveMeasurement, closeContract, discardMeasurement, reopenContract } from '../../actions';
import ContractSheet from '../../ContractSheet';
import SummaryCard from '../../SummaryCard';
import { fmtDate, fmtDateTime, measurementStatus, money, nextReference, num, pct } from '../../format';
import type { Contract, ContractSummary, Team, Work, WorkTeam } from '../../types';
import AddServicesSheet from './AddServicesSheet';
import AditivoSheet from './AditivoSheet';
import NewMeasurementSheet from './NewMeasurementSheet';
import type { Amendment, HistoryEvent, ServiceRow } from './types';

type Measurement = Database['public']['Tables']['medicoes_servico']['Row'];
type ItemTotal = { medicao_id: string; vinculacao_id: string; valor_calculado: number; tipo: Database['public']['Enums']['tipo_item_medicao'] };
type Tab = 'itens' | 'medicoes' | 'historico';

const n = (v: number | null | undefined) => Number(v ?? 0);
const adNumber = (v: number) => `AD-${String(v).padStart(2, '0')}`;

export default function ContractDetailClient({
  contract, summary, obraNome, equipeNome, measurements, itemTotals, services, amendments, events, createdBy, updatedBy, works, teams, workTeams,
}: {
  contract: Contract;
  summary: ContractSummary | null;
  obraNome: string;
  equipeNome: string;
  measurements: Measurement[];
  itemTotals: ItemTotal[];
  services: ServiceRow[];
  amendments: Amendment[];
  events: HistoryEvent[];
  createdBy: string | null;
  updatedBy: string | null;
  works: Work[];
  teams: Team[];
  workTeams: WorkTeam[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = params.get('aba');
  const [tab, setTab] = useState<Tab>(initialTab === 'medicoes' || initialTab === 'historico' ? initialTab : 'itens');
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [adding, setAdding] = useState(false);
  const [amending, setAmending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  const active = contract.status === 'ativo';

  const totals = new Map<string, { value: number; count: number; rework: boolean }>();
  for (const item of itemTotals) {
    const t = totals.get(item.medicao_id) ?? { value: 0, count: 0, rework: false };
    t.value += Number(item.valor_calculado);
    t.count += 1;
    t.rework = t.rework || item.tipo === 'retrabalho';
    totals.set(item.medicao_id, t);
  }
  const approvedTotal = measurements.filter(m => m.status === 'aprovada').reduce((s, m) => s + (totals.get(m.id)?.value ?? 0), 0);
  const hasApproved = measurements.some(m => m.status === 'aprovada');
  const reference = n(summary?.valor_referencia);

  // Itens: contratado e saldo pelo preço atual; medido pelo valor das medições aprovadas.
  const itemRows = services.map(s => {
    const contratado = s.previsto * (s.preco ?? 0);
    const saldoQtd = Math.max(s.previsto - s.medido, 0);
    return { ...s, contratado, saldoQtd, saldoValor: saldoQtd * (s.preco ?? 0) };
  });
  const itemsTotal = itemRows.reduce((acc, r) => ({
    contratado: acc.contratado + r.contratado,
    medido: acc.medido + r.valorMedido,
    saldo: acc.saldo + r.saldoValor,
    liberado: acc.liberado + r.valorLiberado,
  }), { contratado: 0, medido: 0, saldo: 0, liberado: 0 });

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast(result.error ?? 'Falha na operação.', 'error');
        return;
      }
      toast(ok, 'success');
      router.refresh();
    });
  }

  const itemColumns: Column<(typeof itemRows)[number]>[] = [
    {
      header: 'Item / serviço',
      cell: s => (
        <div className="flex min-w-[180px] flex-col gap-0.5">
          <span className="text-[13px] text-txt-2">{s.ambiente}</span>
          <span className="font-bold text-txt">{s.servico}</span>
          <span className="prumo-metric text-xs text-txt-2">{s.preco == null ? 'sem preço' : `${money(s.preco)} / ${s.unidade}`}</span>
        </div>
      ),
    },
    {
      header: 'Contratado',
      align: 'right',
      cell: s => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="prumo-metric text-[13px]">{num(s.previsto)} {s.unidade}</span>
          <span className="prumo-metric font-bold">{money(s.contratado)}</span>
        </div>
      ),
    },
    {
      header: 'Medido',
      cell: s => (
        <div className="flex min-w-[170px] flex-col gap-1">
          <ProgressBar value={pct(s.medido, s.previsto)} showLabel />
          <span className="prumo-metric text-xs text-txt-2">{num(s.medido)} {s.unidade} · <b className="text-txt">{money(s.valorMedido)}</b></span>
        </div>
      ),
    },
    {
      header: 'Saldo a medir',
      align: 'right',
      cell: s => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="prumo-metric text-[13px]">{num(s.saldoQtd)} {s.unidade}</span>
          <span className="prumo-metric font-bold">{money(s.saldoValor)}</span>
        </div>
      ),
    },
    {
      header: 'Liberado agora',
      align: 'right',
      cell: s => (
        <div className="flex flex-col items-end gap-1">
          <span className={`prumo-pill prumo-metric ${s.liberado > 0 ? 'bg-accent-soft text-txt' : 'bg-bg-0 text-txt-2'}`}>{num(s.liberado)} {s.unidade}</span>
          {s.bloqueado > 0 ? <span className="text-xs font-semibold text-nok">{num(s.bloqueado)} {s.unidade} bloqueados</span> : null}
        </div>
      ),
    },
    {
      header: '',
      align: 'right',
      cell: s => (
        <Link href={`/obras/${contract.obra_id}/ambiente/${s.ambienteId}/fvs/${s.fvsId}/medicao?contrato=${contract.id}`} onClick={e => e.stopPropagation()} className="prumo-row-button">
          Configurar
        </Link>
      ),
    },
  ];

  const measurementColumns: Column<Measurement>[] = [
    {
      header: 'Medição',
      cell: m => {
        const t = totals.get(m.id);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-txt">{m.referencia}</span>
            <span className="text-[13px] text-txt-2">{t?.count ?? 0} {t?.count === 1 ? 'item' : 'itens'}{t?.rework ? ' · com retrabalho' : ''}</span>
          </div>
        );
      },
    },
    { header: 'Período', cell: m => <span className="prumo-metric text-[13px]">{fmtDate(m.periodo_inicio)} – {fmtDate(m.periodo_fim)}</span> },
    { header: 'Data', cell: m => <span className="prumo-metric text-[13px]">{fmtDate(m.data_medicao)}</span> },
    { header: 'Valor', align: 'right', cell: m => <span className="prumo-metric font-bold">{money(totals.get(m.id)?.value)}</span> },
    { header: 'Situação', cell: m => <span className={`prumo-pill ${measurementStatus[m.status]?.className ?? ''}`}>{measurementStatus[m.status]?.label ?? m.status}</span> },
    {
      header: '',
      align: 'right',
      cell: m => m.status === 'rascunho' ? (
        <div className="flex justify-end gap-1.5">
          <button type="button" disabled={pending} onClick={e => { e.stopPropagation(); run(() => approveMeasurement(m.id, m.obra_id), 'Medição aprovada.'); }} className="prumo-row-button bg-sidebar text-white hover:bg-brand-dark">Aprovar</button>
          <button type="button" disabled={pending} onClick={e => { e.stopPropagation(); run(() => discardMeasurement(m.id, m.obra_id), 'Rascunho descartado.'); }} className="prumo-row-button">Descartar</button>
        </div>
      ) : <span className="text-[13px] font-semibold text-txt-2">Ver detalhe</span>,
    },
  ];

  return (
    <>
      <PageHeader
        kicker={<span className="prumo-metric">{contract.numero}</span>}
        title={contract.objeto}
        actions={
          <>
            {active ? (
              <button type="button" onClick={() => { setReason(''); setClosing(true); }} className="prumo-secondary-button">Encerrar</button>
            ) : (
              <button type="button" disabled={pending} onClick={() => run(() => reopenContract(contract.id, contract.obra_id), 'Contrato reaberto.')} className="prumo-secondary-button">Reabrir</button>
            )}
            <button type="button" onClick={() => setEditing(true)} className="prumo-secondary-button">Editar</button>
            <a href={`/admin/relatorio/medicoes?contrato=${contract.id}`} target="_blank" rel="noreferrer" className="prumo-secondary-button">
              <Printer size={17} /> Gerar PDF
            </a>
            {active ? (
              <button type="button" onClick={() => setAmending(true)} className="prumo-secondary-button">
                <FileText size={17} /> Novo aditivo
              </button>
            ) : null}
            {active ? (
              <button type="button" onClick={() => setMeasuring(true)} disabled={!services.length} className="prumo-primary-button disabled:opacity-50">
                <Plus size={17} /> Nova medição
              </button>
            ) : null}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`prumo-pill ${active ? 'bg-ok-bg text-ok' : 'bg-bg-1 text-txt-2'}`}>{active ? 'Ativo' : 'Encerrado'}</span>
          <span className="prumo-pill bg-bg-1 text-txt">{equipeNome}</span>
          <Link href={`/obras/${contract.obra_id}`} className="prumo-pill bg-bg-1 text-txt hover:bg-bg-2">{obraNome}</Link>
          <span className="prumo-pill prumo-metric bg-bg-1 text-txt">
            {fmtDate(contract.data_inicio)} → {contract.data_fim ? fmtDate(contract.data_fim) : 'sem término'}
          </span>
          {amendments.length ? <span className="prumo-pill bg-bg-1 text-txt">{amendments.length} {amendments.length === 1 ? 'aditivo' : 'aditivos'}</span> : null}
        </div>
        <p className="mt-2 text-[13px] text-txt-2">
          Criado em {fmtDateTime(contract.created_at)} por {createdBy ?? (contract.criado_por ? '—' : 'migração automática')}
          {' · '}última alteração em {fmtDateTime(contract.updated_at)} por {updatedBy ?? createdBy ?? (contract.criado_por ? '—' : 'migração automática')}
        </p>
        {!active && contract.motivo_encerramento ? <p className="mt-1 text-sm text-txt-2">Encerrado: {contract.motivo_encerramento}</p> : null}
        {contract.observacao ? <p className="mt-1 max-w-[760px] text-sm text-txt-2">{contract.observacao}</p> : null}
      </PageHeader>

      <SummaryCard
        ariaLabel="Resumo do contrato"
        label={`Medido de ${money(reference)} ${contract.valor_contratado == null ? 'previstos' : 'contratados'}`}
        measured={approvedTotal}
        reference={reference}
        caption={`${n(summary?.medicoes_aprovadas)} ${n(summary?.medicoes_aprovadas) === 1 ? 'medição aprovada' : 'medições aprovadas'}${summary?.ultima_medicao ? ` · última em ${fmtDate(summary.ultima_medicao)}` : ''}`}
        toMeasure={contract.valor_contratado == null ? itemsTotal.saldo : n(summary?.valor_a_medir)}
        released={itemsTotal.liberado}
        blocked={n(summary?.valor_bloqueado)}
      />

      <Tabs
        ariaLabel="Seções do contrato"
        value={tab}
        onChange={id => setTab(id as Tab)}
        tabs={[
          { id: 'itens', label: 'Itens do contrato', count: services.length },
          { id: 'medicoes', label: 'Medições', count: measurements.length },
          { id: 'historico', label: 'Aditivos e histórico', count: amendments.length },
        ]}
        trailing={tab === 'itens' && active && !hasApproved ? (
          <button type="button" onClick={() => setAdding(true)} className="prumo-secondary-button">
            <Plus size={17} /> Adicionar serviços
          </button>
        ) : null}
      />

      <div className="mt-4">
        {tab === 'itens' ? (
          <>
            <p className="mb-3 text-sm text-txt-2">
              Contratado e saldo pelo preço atual. Medido é o valor das medições aprovadas.
              {hasApproved && active ? ' Para mudar itens, quantidades ou preços, use "Novo aditivo".' : ''}
            </p>
            <DataTable
              data={itemRows}
              columns={itemColumns}
              rowKey={s => s.fvsId}
              emptyMessage="Nenhum item neste contrato"
              emptyHint={active ? 'Use "Adicionar serviços" para escolher as FVS da obra que este contrato cobre.' : undefined}
              footer={itemRows.length ? (
                <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm font-bold">
                  <span>Contratado <span className="prumo-metric ml-2">{money(itemsTotal.contratado)}</span></span>
                  <span>Medido <span className="prumo-metric ml-2">{money(itemsTotal.medido)}</span></span>
                  <span>Saldo a medir <span className="prumo-metric ml-2">{money(itemsTotal.saldo)}</span></span>
                </div>
              ) : undefined}
            />
          </>
        ) : null}

        {tab === 'medicoes' ? (
          <DataTable
            data={measurements}
            columns={measurementColumns}
            rowKey={m => m.id}
            onRowClick={m => router.push(`/medicoes/m/${m.id}`)}
            emptyMessage="Nenhuma medição neste contrato"
            emptyHint={services.length ? 'Quando as FVS dos itens forem aprovadas, use "Nova medição".' : 'Adicione os itens do contrato primeiro.'}
            footer={hasApproved ? (
              <div className="flex justify-between gap-3 text-sm font-bold">
                <span>Total aprovado</span>
                <span className="prumo-metric">{money(approvedTotal)}</span>
              </div>
            ) : undefined}
          />
        ) : null}

        {tab === 'historico' ? <History amendments={amendments} events={events} /> : null}
      </div>

      {editing ? (
        <ContractSheet isOpen onClose={() => setEditing(false)} contract={contract} works={works} teams={teams} workTeams={workTeams} onSaved={() => { setEditing(false); router.refresh(); }} />
      ) : null}
      {measuring ? (
        <NewMeasurementSheet
          contract={contract}
          equipeNome={equipeNome}
          suggestedReference={nextReference(measurements.map(m => m.referencia))}
          lastPeriodEnd={measurements.filter(m => m.status !== 'cancelada').map(m => m.periodo_fim).sort().at(-1) ?? null}
          onClose={() => setMeasuring(false)}
          onSaved={id => { setMeasuring(false); router.push(`/medicoes/m/${id}`); }}
        />
      ) : null}
      {adding ? <AddServicesSheet contract={contract} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); router.refresh(); }} /> : null}
      {amending ? (
        <AditivoSheet
          contract={contract}
          services={services}
          currentValue={reference}
          nextNumber={(amendments[0]?.numero ?? 0) + 1}
          onClose={() => setAmending(false)}
          onSaved={() => { setAmending(false); setTab('historico'); router.refresh(); }}
        />
      ) : null}

      <Modal
        isOpen={closing}
        onClose={() => setClosing(false)}
        title={`Encerrar ${contract.numero}`}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setClosing(false)} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">Voltar</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(async () => { const r = await closeContract(contract.id, contract.obra_id, reason); if (r.success) setClosing(false); return r; }, 'Contrato encerrado.')}
              className="prumo-primary-button disabled:opacity-50"
            >
              Encerrar contrato
            </button>
          </>
        }
      >
        <p className="text-sm text-txt-2">O contrato deixa de receber serviços e medições novas. O histórico continua visível e você pode reabrir depois.</p>
        <label className="mt-4 flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Motivo (opcional)
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className="prumo-field py-2.5" />
        </label>
      </Modal>
    </>
  );
}

function History({ amendments, events }: { amendments: Amendment[]; events: HistoryEvent[] }) {
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Aditivos" className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold text-txt">Aditivos</h2>
        {amendments.length ? amendments.map(a => {
          const diff = a.valorNovo - a.valorAnterior;
          return (
            <article key={a.id} className="rounded-xl bg-bg-1 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="prumo-metric text-txt">{adNumber(a.numero)}</b>
                    <span className="font-bold text-txt">{a.descricao}</span>
                  </span>
                  <span className="text-[13px] text-txt-2">
                    Data {fmtDate(a.data)} · registrado em {fmtDateTime(a.createdAt)} por <b className="text-txt">{a.autor ?? '—'}</b>
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="prumo-metric text-sm">{money(a.valorAnterior)} → <b>{money(a.valorNovo)}</b></span>
                  <span className={`prumo-metric text-xs font-bold ${diff > 0 ? 'text-ok' : diff < 0 ? 'text-nok' : 'text-txt-2'}`}>{diff > 0 ? '+' : ''}{money(diff)}</span>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="prumo-th py-2 pr-3">Item</th>
                      <th className="prumo-th py-2 pr-3 text-right">Quantidade</th>
                      <th className="prumo-th py-2 pr-3 text-right">Preço</th>
                      <th className="prumo-th py-2 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.itens.map(i => {
                      const d = i.quantidadeNova * (i.precoNovo ?? 0) - i.quantidadeAnterior * (i.precoAnterior ?? 0);
                      return (
                        <tr key={i.fvsId} className="border-t border-brd-0">
                          <td className="py-2.5 pr-3">
                            {i.tipo === 'inclusao' ? <span className="prumo-pill mr-2 bg-pg-bg text-pg">Incluído</span> : null}
                            {i.servico}
                          </td>
                          <td className="prumo-metric py-2.5 pr-3 text-right text-[13px]">
                            {i.tipo === 'inclusao' || i.quantidadeAnterior === i.quantidadeNova ? `${num(i.quantidadeNova)} ${i.unidade}` : `${num(i.quantidadeAnterior)} → ${num(i.quantidadeNova)} ${i.unidade}`}
                          </td>
                          <td className="prumo-metric py-2.5 pr-3 text-right text-[13px]">
                            {i.tipo === 'inclusao' || i.precoAnterior === i.precoNovo ? (i.precoNovo == null ? '—' : money(i.precoNovo)) : `${i.precoAnterior == null ? '—' : money(i.precoAnterior)} → ${i.precoNovo == null ? '—' : money(i.precoNovo)}`}
                          </td>
                          <td className={`prumo-metric py-2.5 text-right font-bold ${d > 0 ? 'text-ok' : d < 0 ? 'text-nok' : 'text-txt-2'}`}>{d > 0 ? '+' : ''}{money(d)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          );
        }) : <p className="rounded-xl bg-bg-1 p-5 text-sm text-txt-2">Nenhum aditivo. Use "Novo aditivo" para incluir itens ou mudar quantidades e preços.</p>}
      </section>

      <section aria-label="Histórico" className="rounded-xl bg-bg-1 p-5">
        <h2 className="text-lg font-extrabold text-txt">Histórico do contrato</h2>
        {events.length ? (
          <ol className="mt-3 flex flex-col gap-3 text-sm">
            {events.map(e => (
              <li key={e.id} className="flex gap-3">
                <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sidebar" />
                <span className="flex flex-col gap-0.5">
                  <span><b className="text-txt">{e.texto}</b> · {e.autor ?? '—'} <span className="prumo-metric text-[13px] text-txt-2">{fmtDateTime(e.quando)}</span></span>
                  {e.detalhe ? <span className="text-[13px] text-txt-2">{e.detalhe}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-sm text-txt-2">Sem registros ainda.</p>}
      </section>
    </div>
  );
}
