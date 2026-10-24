import { useState, useTransition } from 'react';
import { Plus, Printer } from '@/components/icons';
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
import { fmtDate, measurementStatus, money, nextReference, num, pct } from '../../format';
import type { Contract, ContractSummary, Team, Work, WorkTeam } from '../../types';
import AddServicesSheet from './AddServicesSheet';
import NewMeasurementSheet from './NewMeasurementSheet';

type Measurement = Database['public']['Tables']['medicoes_servico']['Row'];
type ItemTotal = { medicao_id: string; valor_calculado: number; tipo: Database['public']['Enums']['tipo_item_medicao'] };
export type ServiceRow = {
  fvsId: string; ambienteId: string; ambiente: string; servico: string; unidade: string;
  metodo: Database['public']['Enums']['metodo_medicao_servico']; preco: number | null;
  previsto: number; aprovado: number; medido: number; liberado: number; bloqueado: number;
  valorLiberado: number; valorBloqueado: number; valorMedido: number;
};
type Tab = 'medicoes' | 'a-medir';

const n = (v: number | null | undefined) => Number(v ?? 0);

export default function ContractDetailClient({ contract, summary, obraNome, equipeNome, measurements, itemTotals, services, works, teams, workTeams }: {
  contract: Contract;
  summary: ContractSummary | null;
  obraNome: string;
  equipeNome: string;
  measurements: Measurement[];
  itemTotals: ItemTotal[];
  services: ServiceRow[];
  works: Work[];
  teams: Team[];
  workTeams: WorkTeam[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('aba') === 'a-medir' ? 'a-medir' : 'medicoes');
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [adding, setAdding] = useState(false);
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
  const reference = n(summary?.valor_referencia);

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

  const measurementColumns: Column<Measurement>[] = [
    {
      header: 'Medição',
      cell: m => {
        const t = totals.get(m.id);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-txt">{m.referencia}</span>
            <span className="text-[13px] text-txt-2">
              {t?.count ?? 0} {t?.count === 1 ? 'item' : 'itens'}{t?.rework ? ' · com retrabalho' : ''}
            </span>
          </div>
        );
      },
    },
    { header: 'Período', cell: m => <span className="prumo-metric text-[13px]">{fmtDate(m.periodo_inicio)} – {fmtDate(m.periodo_fim)}</span> },
    { header: 'Data', cell: m => <span className="prumo-metric text-[13px]">{fmtDate(m.data_medicao)}</span> },
    { header: 'Valor', align: 'right', cell: m => <span className="prumo-metric font-bold">{money(totals.get(m.id)?.value)}</span> },
    {
      header: 'Situação',
      cell: m => <span className={`prumo-pill ${measurementStatus[m.status]?.className ?? ''}`}>{measurementStatus[m.status]?.label ?? m.status}</span>,
    },
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

  const serviceColumns: Column<ServiceRow>[] = [
    {
      header: 'Serviço',
      cell: s => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-txt-2">{s.ambiente}</span>
          <span className="font-bold text-txt">{s.servico}</span>
          <span className="prumo-metric text-xs text-txt-2">{s.preco == null ? 'sem preço' : `${money(s.preco)} / ${s.unidade}`}</span>
        </div>
      ),
    },
    { header: 'Avanço medido', width: '170px', cell: s => <div className="min-w-[140px]"><ProgressBar value={pct(s.medido, s.previsto)} showLabel /></div> },
    { header: 'Previsto', align: 'right', cell: s => <span className="prumo-metric text-[13px]">{num(s.previsto)} {s.unidade}</span> },
    { header: 'Aprovado em campo', align: 'right', cell: s => <span className="prumo-metric text-[13px]">{num(s.aprovado)} {s.unidade}</span> },
    { header: 'Medido', align: 'right', cell: s => <span className="prumo-metric text-[13px]">{num(s.medido)} {s.unidade}</span> },
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
      header: 'Valor a medir',
      align: 'right',
      cell: s => <span className="prumo-metric font-bold">{money(Math.max(s.previsto - s.medido, 0) * (s.preco ?? 0))}</span>,
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

  const toMeasureTotal = services.reduce((sum, s) => sum + Math.max(s.previsto - s.medido, 0) * (s.preco ?? 0), 0);
  const releasedTotal = services.reduce((sum, s) => sum + s.valorLiberado, 0);

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
        </div>
        {!active && contract.motivo_encerramento ? <p className="mt-2 text-sm text-txt-2">Encerrado: {contract.motivo_encerramento}</p> : null}
        {contract.observacao ? <p className="mt-2 max-w-[760px] text-sm text-txt-2">{contract.observacao}</p> : null}
      </PageHeader>

      <SummaryCard
        ariaLabel="Resumo do contrato"
        label={`Medido de ${money(reference)} ${contract.valor_contratado == null ? 'previstos' : 'contratados'}`}
        measured={approvedTotal}
        reference={reference}
        caption={`${n(summary?.medicoes_aprovadas)} ${n(summary?.medicoes_aprovadas) === 1 ? 'medição aprovada' : 'medições aprovadas'}${summary?.ultima_medicao ? ` · última em ${fmtDate(summary.ultima_medicao)}` : ''}`}
        toMeasure={contract.valor_contratado == null ? toMeasureTotal : n(summary?.valor_a_medir)}
        released={releasedTotal}
        blocked={n(summary?.valor_bloqueado)}
      />

      <Tabs
        ariaLabel="Seções do contrato"
        value={tab}
        onChange={id => setTab(id as Tab)}
        tabs={[
          { id: 'medicoes', label: 'Medições', count: measurements.length },
          { id: 'a-medir', label: 'A medir', count: services.length },
        ]}
        trailing={tab === 'a-medir' && active ? (
          <button type="button" onClick={() => setAdding(true)} className="prumo-secondary-button">
            <Plus size={17} /> Adicionar serviços
          </button>
        ) : null}
      />

      <div className="mt-4">
        {tab === 'medicoes' ? (
          <DataTable
            data={measurements}
            columns={measurementColumns}
            rowKey={m => m.id}
            onRowClick={m => router.push(`/medicoes/m/${m.id}`)}
            emptyMessage="Nenhuma medição neste contrato"
            emptyHint={services.length ? 'Quando as FVS dos serviços forem aprovadas, use "Nova medição".' : 'Adicione os serviços do contrato na aba "A medir".'}
            footer={measurements.some(m => m.status === 'aprovada') ? (
              <div className="flex justify-between gap-3 text-sm font-bold">
                <span>Total aprovado</span>
                <span className="prumo-metric">{money(approvedTotal)}</span>
              </div>
            ) : undefined}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-txt-2">
              <b className="text-txt">Liberado agora</b> é o que já foi aprovado nas FVS e ainda não entrou numa medição.
            </p>
            <DataTable
              data={services}
              columns={serviceColumns}
              rowKey={s => s.fvsId}
              emptyMessage="Nenhum serviço neste contrato"
              emptyHint={active ? 'Use "Adicionar serviços" para escolher as FVS da obra que este contrato cobre.' : undefined}
              footer={services.length ? (
                <div className="flex flex-wrap justify-end gap-6 text-sm font-bold">
                  <span>Liberado agora <span className="prumo-metric ml-2">{money(releasedTotal)}</span></span>
                  <span>A medir <span className="prumo-metric ml-2">{money(toMeasureTotal)}</span></span>
                </div>
              ) : undefined}
            />
          </>
        )}
      </div>

      {editing ? (
        <ContractSheet
          isOpen
          onClose={() => setEditing(false)}
          contract={contract}
          works={works}
          teams={teams}
          workTeams={workTeams}
          onSaved={() => { setEditing(false); router.refresh(); }}
        />
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

      {adding ? (
        <AddServicesSheet
          contract={contract}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); router.refresh(); }}
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
        <p className="text-sm text-txt-2">
          O contrato deixa de receber serviços e medições novas. O histórico continua visível e você pode reabrir depois.
        </p>
        <label className="mt-4 flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Motivo (opcional)
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className="prumo-field py-2.5" />
        </label>
      </Modal>
    </>
  );
}
