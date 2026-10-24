import { useMemo, useState } from 'react';
import { Plus, Printer } from '@/components/icons';
import PageHeader from '@/components/layout/PageHeader';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { FilterBar, SearchField, SelectFilter } from '@/components/ui/FilterBar';
import ProgressBar from '@/components/ui/ProgressBar';
import Tabs from '@/components/ui/Tabs';
import { useRouter } from '@/lib/compat/navigation';
import ContractSheet from './ContractSheet';
import SummaryCard from './SummaryCard';
import { fmtDate, money, pct } from './format';
import type { Contract, ContractSummary, Team, Work, WorkTeam } from './types';

type Row = Contract & { summary: ContractSummary | undefined; obraNome: string; equipeNome: string };
type Situation = 'ativo' | 'encerrado' | 'todos';

const n = (v: number | null | undefined) => Number(v ?? 0);

export default function ContractsClient({ contracts, summaries, works, teams, workTeams, users }: {
  contracts: Contract[];
  summaries: ContractSummary[];
  works: Work[];
  teams: Team[];
  workTeams: WorkTeam[];
  users: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [obra, setObra] = useState('');
  const [equipe, setEquipe] = useState('');
  const [situation, setSituation] = useState<Situation>('ativo');
  const [creating, setCreating] = useState(false);

  const rows: Row[] = useMemo(() => {
    const workName = new Map(works.map(w => [w.id, w.nome]));
    const teamName = new Map(teams.map(t => [t.id, t.nome]));
    const summaryById = new Map(summaries.map(s => [s.contrato_id, s]));
    return contracts.map(c => ({
      ...c,
      summary: summaryById.get(c.id),
      obraNome: workName.get(c.obra_id) ?? '',
      equipeNome: teamName.get(c.equipe_id) ?? '',
    }));
  }, [contracts, summaries, works, teams]);

  const byFilters = rows.filter(r => {
    if (obra && r.obra_id !== obra) return false;
    if (equipe && r.equipe_id !== equipe) return false;
    const q = search.trim().toLowerCase();
    if (q && ![r.numero, r.objeto, r.equipeNome, r.obraNome].some(v => v.toLowerCase().includes(q))) return false;
    return true;
  });
  const visible = byFilters.filter(r => situation === 'todos' || r.status === situation);
  const active = byFilters.filter(r => r.status === 'ativo');
  const totals = active.reduce((acc, r) => ({
    reference: acc.reference + n(r.summary?.valor_referencia),
    measured: acc.measured + n(r.summary?.valor_medido),
    toMeasure: acc.toMeasure + n(r.summary?.valor_a_medir),
    released: acc.released + n(r.summary?.valor_liberado),
    blocked: acc.blocked + n(r.summary?.valor_bloqueado),
    count: acc.count + n(r.summary?.medicoes_aprovadas),
  }), { reference: 0, measured: 0, toMeasure: 0, released: 0, blocked: 0, count: 0 });

  const userName = new Map(users.map(u => [u.id, u.nome]));
  const usedTeams = teams.filter(t => rows.some(r => r.equipe_id === t.id));
  const usedWorks = works.filter(w => rows.some(r => r.obra_id === w.id) || w.controle_medicoes_efetivo);
  const canCreate = works.some(w => w.controle_medicoes_efetivo);
  const pdfHref = `/admin/relatorio/medicoes${obra ? `?obra=${obra}` : ''}`;
  const lastNumber = Math.max(0, ...contracts.map(c => Number(/(\d+)\s*$/.exec(c.numero)?.[1] ?? 0)));
  const suggestedNumber = `CT-${String(lastNumber + 1).padStart(3, '0')}`;

  const columns: Column<Row>[] = [
    {
      header: 'Contrato',
      cell: r => (
        <div className="flex flex-col gap-0.5">
          <span className="prumo-metric text-xs font-bold text-txt-2">{r.numero}</span>
          <span className="font-bold text-txt">{r.objeto}</span>
        </div>
      ),
    },
    {
      header: 'Empreiteiro · obra',
      cell: r => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-txt">{r.equipeNome}</span>
          <span className="text-[13px] text-txt-2">{r.obraNome}</span>
        </div>
      ),
    },
    { header: 'Contratado', align: 'right', cell: r => <span className="prumo-metric">{money(r.summary?.valor_referencia)}</span> },
    {
      header: 'Medido',
      width: '190px',
      cell: r => <div className="min-w-[150px]"><ProgressBar value={pct(n(r.summary?.valor_medido), n(r.summary?.valor_referencia))} showLabel /></div>,
    },
    { header: 'A medir', align: 'right', cell: r => <span className="prumo-metric font-bold">{money(r.summary?.valor_a_medir)}</span> },
    { header: 'Atenção', cell: r => <Attention row={r} /> },
    {
      header: 'Registro',
      cell: r => (
        <div className="flex min-w-[170px] flex-col gap-0.5 text-xs text-txt-2">
          <span>Criado <b className="prumo-metric font-medium text-txt">{fmtDate(r.created_at.slice(0, 10))}</b> · {r.criado_por ? userName.get(r.criado_por) ?? '—' : 'migração automática'}</span>
          <span>Alterado <b className="prumo-metric font-medium text-txt">{fmtDate(r.updated_at.slice(0, 10))}</b> · {r.updated_by ? userName.get(r.updated_by) ?? '—' : r.criado_por ? userName.get(r.criado_por) ?? '—' : 'migração automática'}</span>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        kicker="Contratos de empreiteiros em todas as obras"
        title="Contratos e medições"
        actions={
          <>
            <a href={pdfHref} target="_blank" rel="noreferrer" className="prumo-secondary-button">
              <Printer size={17} /> Gerar PDF
            </a>
            <button type="button" onClick={() => setCreating(true)} disabled={!canCreate} className="prumo-primary-button disabled:opacity-50">
              <Plus size={17} /> Novo contrato
            </button>
          </>
        }
      />

      <FilterBar>
        <SearchField value={search} onChange={setSearch} placeholder="Buscar nº, objeto ou empreiteiro" />
        <SelectFilter label="Obra" value={obra} onChange={setObra} options={[{ value: '', label: 'Todas' }, ...usedWorks.map(w => ({ value: w.id, label: w.nome }))]} />
        <SelectFilter label="Empreiteiro" value={equipe} onChange={setEquipe} options={[{ value: '', label: 'Todos' }, ...usedTeams.map(t => ({ value: t.id, label: t.nome }))]} />
        <Tabs
          variant="segmented"
          className="ml-auto"
          ariaLabel="Situação dos contratos"
          value={situation}
          onChange={id => setSituation(id as Situation)}
          tabs={[
            { id: 'ativo', label: 'Ativos', count: byFilters.filter(r => r.status === 'ativo').length },
            { id: 'encerrado', label: 'Encerrados', count: byFilters.filter(r => r.status === 'encerrado').length },
            { id: 'todos', label: 'Todos', count: byFilters.length },
          ]}
        />
      </FilterBar>

      <div className="mb-5">
        <SummaryCard
          ariaLabel="Resumo dos contratos ativos"
          label="Medido nos contratos ativos"
          measured={totals.measured}
          reference={totals.reference}
          caption={`de ${money(totals.reference)} contratados · ${totals.count} ${totals.count === 1 ? 'medição aprovada' : 'medições aprovadas'}`}
          toMeasure={totals.toMeasure}
          released={totals.released}
          blocked={totals.blocked}
        />
      </div>

      <DataTable
        data={visible}
        columns={columns}
        rowKey={r => r.id}
        onRowClick={r => router.push(`/medicoes/contratos/${r.id}`)}
        emptyMessage={contracts.length ? 'Nenhum contrato neste filtro' : 'Nenhum contrato cadastrado'}
        emptyHint={contracts.length ? 'Mude a busca ou a situação.' : canCreate ? 'Crie o primeiro contrato e adicione os serviços que ele cobre.' : 'Ligue o controle de medições numa obra para cadastrar contratos.'}
      />

      {creating ? (
        <ContractSheet
          isOpen
          onClose={() => setCreating(false)}
          works={works}
          teams={teams}
          workTeams={workTeams}
          suggestedNumber={suggestedNumber}
          onSaved={id => { setCreating(false); router.push(`/medicoes/contratos/${id}?aba=a-medir`); }}
        />
      ) : null}
    </>
  );
}

function Attention({ row }: { row: Row }) {
  const s = row.summary;
  const pills: { label: string; className: string }[] = [];
  if (row.status === 'encerrado') pills.push({ label: `Encerrado${row.encerrado_em ? ` em ${fmtDate(row.encerrado_em.slice(0, 10))}` : ''}`, className: 'bg-bg-0 text-txt-2' });
  if (n(s?.rascunhos) > 0) pills.push({ label: n(s?.rascunhos) === 1 ? '1 rascunho' : `${n(s?.rascunhos)} rascunhos`, className: 'bg-warn-bg text-warn' });
  if (n(s?.valor_bloqueado) > 0) pills.push({ label: `${money(s?.valor_bloqueado)} bloqueado`, className: 'bg-nok-bg text-nok' });
  if (row.status === 'ativo' && n(s?.valor_liberado) > 0) pills.push({ label: `${money(s?.valor_liberado)} liberado`, className: 'bg-ok-bg text-ok' });
  if (!pills.length && n(s?.servicos) === 0) pills.push({ label: 'Sem serviços', className: 'bg-bg-0 text-txt-2' });
  if (!pills.length && n(s?.medicoes_aprovadas) === 0) pills.push({ label: 'Sem medição', className: 'bg-bg-0 text-txt-2' });
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map(p => <span key={p.label} className={`prumo-pill whitespace-nowrap ${p.className}`}>{p.label}</span>)}
    </div>
  );
}
