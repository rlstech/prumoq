
import { useState, useTransition } from 'react';
import Link from '@/lib/compat/link';
import { AlertTriangle, ArrowRight, HardHat, Layers, Pencil, Plus, Ruler, Trash2 } from '@/components/icons';
import ProgressBar from '@/components/ui/ProgressBar';
import { useRouter } from '@/lib/compat/navigation';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AmbienteModal from './AmbienteModal';
import ObraEquipeModal from './ObraEquipeModal';
import { deleteObra, deleteAmbiente, removeEquipeFromObra } from './actions';
import ObraModal from '../ObraModal';
import ObraFeatureControls from './ObraFeatureControls';
import Tabs from '@/components/ui/Tabs';
import { FilterBar, SearchField } from '@/components/ui/FilterBar';
import DataTable from '@/components/ui/DataTable';

export interface MeasurementServiceSummary {
  fvsId: string;
  ambienteId: string;
  subservico: string;
  ambienteNome: string;
  metodo: string;
  unidade: string;
  quantidadeTotal: number;
  precoUnitario: number | null;
  empreiteiro: string | null;
  dataInicio: string | null;
  escopo: number;
  aprovado: number;
  medido: number;
  bloqueado: number;
  disponivel: number;
  valorDisponivel: number;
}

interface ObraDetailClientProps {
  obraId: string;
  obra: any;
  empresas: { id: string; nome: string }[];
  initialAmbientes: any[];
  ambientesWithVerificacoes: Record<string, boolean>;
  medicoesServices: MeasurementServiceSummary[];
  fvsPadraoList: any[];
  obraEquipes: { id: string; nome: string; tipo: string; especialidade?: string }[];
  availableEquipes: { id: string; nome: string; tipo: string; especialidade?: string }[];
  totalEmpresaEquipes: number;
  totalUsuariosVinculados: number;
  canDelete: boolean;
}

export default function ObraDetailClient({
  obraId,
  obra,
  empresas,
  initialAmbientes,
  ambientesWithVerificacoes,
  medicoesServices,
  fvsPadraoList,
  obraEquipes,
  availableEquipes,
  totalEmpresaEquipes,
  totalUsuariosVinculados,
  canDelete,
}: ObraDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('ambientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [isAmbienteModalOpen, setIsAmbienteModalOpen] = useState(false);
  const [isEquipeModalOpen, setIsEquipeModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmAmbienteDelete, setConfirmAmbienteDelete] = useState<{ id: string; name: string } | null>(null);

  const filtered = initialAmbientes.filter(a => {
    if (filterType === 'Com NC' && !(a.ncs_abertas > 0)) return false;
    if (filterType !== 'Todos' && filterType !== 'Com NC' && filterType !== a.tipo) return false;
    return (
      a.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.localizacao || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  function handleRemoveEquipe(equipeId: string) {
    setRemovingId(equipeId);
    startTransition(async () => {
      const result = await removeEquipeFromObra(obraId, equipeId);
      setRemovingId(null);
      if (result.success) {
        toast('Equipe removida da obra.', 'success');
        router.refresh();
      } else {
        toast(result.error ?? 'Erro ao remover equipe.', 'error');
      }
    });
  }

  const hasAssociations =
    initialAmbientes.length > 0 || obraEquipes.length > 0 || totalUsuariosVinculados > 0;

  function handleDeleteObra() {
    if (!confirmDelete) return;
    startTransition(async () => {
      const result = await deleteObra(confirmDelete.id);
      if (result.success) {
        toast('Obra excluída com sucesso.', 'success');
        setConfirmDelete(null);
        router.push('/obras');
      } else {
        toast('Erro ao excluir obra: ' + (result.error ?? ''), 'error');
        setConfirmDelete(null);
      }
    });
  }

  function handleDeleteAmbiente() {
    if (!confirmAmbienteDelete) return;
    startTransition(async () => {
      const result = await deleteAmbiente(obraId, confirmAmbienteDelete.id);
      if (result.success) {
        toast('Ambiente excluído com sucesso.', 'success');
        setConfirmAmbienteDelete(null);
        router.refresh();
      } else {
        toast(result.error ?? 'Erro ao excluir ambiente.', 'error');
        setConfirmAmbienteDelete(null);
      }
    });
  }

  const tabs = [
    { id: 'ambientes', label: 'Ambientes', count: initialAmbientes.length },
    { id: 'equipe',    label: 'Equipe',    count: obraEquipes.length },
    { id: 'medicoes',  label: 'Medições',  count: medicoesServices.length },
  ];

  const medicoesEnabled = Boolean(obra.controle_medicoes_efetivo);
  const metodoLabels: Record<string, string> = {
    quantidade: 'Quantidade',
    unidade_concluida: 'Unidade concluída',
    etapas_ponderadas: 'Etapas ponderadas',
  };
  const fmt = (v: number | null | undefined, digits = 2) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });
  const money = (v: number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string | null | undefined) => d ? d.slice(0, 10).split('-').reverse().join('/') : '';

  const editInitialData = obra ? {
    id:               obra.id,
    nome:             obra.nome ?? '',
    empresa_id:       obra.empresa_id ?? '',
    status:           obra.status ?? 'nao_iniciada',
    municipio:        obra.municipio ?? '',
    uf:               obra.uf ?? '',
    endereco:         obra.endereco ?? '',
    eng_responsavel:  obra.eng_responsavel ?? '',
    crea_cau:         obra.crea_cau ?? '',
    data_inicio_prev: obra.data_inicio_prev ?? null,
    data_termino_prev: obra.data_termino_prev ?? null,
  } : undefined;

  return (
    <div className="space-y-5">
      <ObraFeatureControls
        obraId={obraId}
        medicionesOverride={obra.controle_medicoes_override ?? null}
        financeiroOverride={obra.controle_financeiro_nc_override ?? null}
        medicionesEffective={Boolean(obra.controle_medicoes_efetivo)}
        financeiroEffective={Boolean(obra.controle_financeiro_nc_efetivo)}
      />
      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Seções da obra"
        className=""
        trailing={
          <button type="button" onClick={() => setIsEditModalOpen(true)} className="prumo-secondary-button">
            <Pencil size={16} /> Editar obra
          </button>
        }
      />

      {/* Tab: Ambientes */}
      {activeTab === 'ambientes' && (
        <div>
          <FilterBar resultLabel={`${filtered.length} de ${initialAmbientes.length} ambientes`}>
            <Tabs
              variant="chips"
              tabs={[
                { id: 'Todos', label: 'Todos', count: initialAmbientes.length },
                { id: 'Interno', label: 'Internos', count: initialAmbientes.filter(a => a.tipo === 'Interno').length },
                { id: 'Externo', label: 'Externos', count: initialAmbientes.filter(a => a.tipo === 'Externo').length },
                { id: 'Com NC', label: 'Com NC', count: initialAmbientes.filter(a => a.ncs_abertas > 0).length },
              ]}
              value={filterType}
              onChange={setFilterType}
              ariaLabel="Recorte de ambientes"
              className=""
            />
            <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Buscar ambiente" className="w-full sm:w-[280px]" />
          </FilterBar>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(amb => {
              const percent = amb.total_fvs > 0 ? Math.round((amb.fvs_concluidas / amb.total_fvs) * 100) : 0;
              const hasNC = amb.ncs_abertas > 0;
              return (
                <div
                  key={amb.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/obras/${obraId}/ambiente/${amb.id}`)}
                  onKeyDown={e => { if (e.key === 'Enter') router.push(`/obras/${obraId}/ambiente/${amb.id}`); }}
                  className="group flex cursor-pointer flex-col gap-3.5 rounded-xl bg-bg-1 p-4 transition-colors hover:bg-bg-hover"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-bg-0 text-txt">
                      <Layers size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-[15px] font-bold text-txt">{amb.nome}</h4>
                      <p className="truncate text-[13px] text-txt-2">{amb.tipo}{amb.localizacao ? ` · ${amb.localizacao}` : ''}</p>
                    </div>
                    {!ambientesWithVerificacoes[amb.id] && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAmbienteDelete({ id: amb.id, name: amb.nome });
                        }}
                        title="Excluir ambiente"
                        aria-label={`Excluir ambiente ${amb.nome}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-txt-2 opacity-0 transition hover:bg-nok-bg hover:text-nok focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <ProgressBar value={percent} variant={hasNC ? 'nok' : 'brand'} showLabel />
                  <div className="flex flex-wrap gap-1.5">
                    <span className="prumo-pill bg-bg-0 font-mono text-txt">{amb.fvs_concluidas}/{amb.total_fvs} FVS</span>
                    {hasNC ? (
                      <span className="prumo-pill bg-nok-bg text-nok">
                        {amb.ncs_abertas} {amb.ncs_abertas > 1 ? 'NCs abertas' : 'NC aberta'}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {/* Novo ambiente */}
            <button
              type="button"
              onClick={() => setIsAmbienteModalOpen(true)}
              className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brd-1 text-txt-2 transition-colors hover:border-brd-2 hover:text-txt"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-txt">
                <Plus size={20} />
              </span>
              <span className="text-sm font-semibold">Novo ambiente</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab: Equipe */}
      {activeTab === 'equipe' && (
        <div className="prumo-panel overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h3 className="text-lg font-bold text-txt">Equipe da obra</h3>
            <button
              type="button"
              onClick={() => setIsEquipeModalOpen(true)}
              className="prumo-row-button"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {obraEquipes.length > 0 ? (
            <div className="px-5 pb-2">
              {obraEquipes.map((eq, idx) => {
                const isProprio = eq.tipo === 'proprio';
                const isRemoving = removingId === eq.id && isPending;
                return (
                  <div key={eq.id} className={`flex items-center gap-3.5 py-3 ${idx ? 'border-t border-brd-0' : ''}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-0 font-mono text-xs font-bold text-txt">
                      {eq.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-sm font-bold text-txt">{eq.nome}</h5>
                      <p className="text-[13px] text-txt-2">{eq.especialidade || 'Geral'}</p>
                    </div>
                    <span className={`prumo-pill ${isProprio ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'}`}>
                      {isProprio ? 'Próprio' : 'Terceirizado'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEquipe(eq.id)}
                      disabled={isRemoving}
                      title="Remover da obra"
                      aria-label={`Remover ${eq.nome} da obra`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-txt-2 transition-colors hover:bg-nok-bg hover:text-nok disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-txt-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-0 text-txt"><HardHat size={22} /></span>
              {totalEmpresaEquipes === 0 ? (
                <>
                  <span>Nenhuma equipe cadastrada para esta empresa.</span>
                  <Link href="/equipes" className="prumo-row-button mt-1">
                    Cadastrar equipes <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <>
                  <span>Nenhuma equipe vinculada a esta obra.</span>
                  <button type="button" onClick={() => setIsEquipeModalOpen(true)} className="prumo-row-button mt-1">
                    <Plus size={14} /> Adicionar equipe
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Medições */}
      {activeTab === 'medicoes' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-txt">Serviços com medição configurada</h3>
            {medicoesServices.length > 0 && (
              <span className="text-[13px] text-txt-2">{medicoesServices.length} serviço(s)</span>
            )}
          </div>

          {!medicoesEnabled ? (
            <div className="prumo-panel flex flex-col items-center gap-2 py-10 text-center text-sm text-txt-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-0 text-txt"><Ruler size={22} /></span>
              <span className="font-semibold text-txt">O controle de medições está desativado nesta obra.</span>
              <span>Ative-o nos recursos opcionais da obra (seção acima).</span>
            </div>
          ) : (
            <DataTable
              data={medicoesServices}
              rowKey={svc => svc.fvsId}
              emptyMessage="Nenhum serviço com medição configurada"
              emptyHint="Abra uma FVS em um ambiente e configure a medição em Medição."
              columns={[
                {
                  header: 'Serviço',
                  cell: svc => <div><div className="text-sm font-bold text-txt">{svc.subservico}</div><div className="text-[13px] text-txt-2">{svc.ambienteNome}</div></div>,
                },
                {
                  header: 'Método',
                  cell: svc => (
                    <span className={`prumo-pill ${
                      svc.metodo === 'quantidade' ? 'bg-pg-bg text-pg'
                      : svc.metodo === 'unidade_concluida' ? 'bg-ok-bg text-ok'
                      : 'bg-warn-bg text-warn'
                    }`}>
                      {metodoLabels[svc.metodo] ?? svc.metodo}
                    </span>
                  ),
                },
                { header: 'Previsto', align: 'right', cell: svc => <span className="prumo-metric text-[13px] text-txt">{fmt(svc.escopo || svc.quantidadeTotal)} {svc.unidade}</span> },
                { header: 'Aprovado', align: 'right', cell: svc => <span className="prumo-metric text-[13px] text-txt">{fmt(svc.aprovado)}</span> },
                { header: 'Disponível', align: 'right', cell: svc => <span className="prumo-metric text-[13px] font-bold text-ok">{fmt(svc.disponivel)}</span> },
                { header: 'Valor disponível', align: 'right', cell: svc => <span className="prumo-metric text-[13px] text-txt">{money(svc.valorDisponivel)}</span> },
                {
                  header: 'Empreiteiro',
                  cell: svc => <div><div className="text-sm text-txt">{svc.empreiteiro ?? '—'}</div>{svc.dataInicio && <div className="text-[13px] text-txt-2">desde {fmtDate(svc.dataInicio)}</div>}</div>,
                },
                {
                  header: '',
                  align: 'right',
                  cell: svc => <Link href={`/obras/${obraId}/ambiente/${svc.ambienteId}/fvs/${svc.fvsId}/medicao`} className="prumo-row-button">Abrir</Link>,
                },
              ]}
            />
          )}
        </div>
      )}

      {/* Exclusão da obra */}
      {canDelete && (
        <section className="prumo-panel mt-8 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-nok-bg text-nok">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-txt">Excluir obra</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-txt-2">
                A exclusão é <span className="font-semibold">permanente</span> e não pode ser desfeita.
                A obra só pode ser excluída se não tiver ambientes, equipes ou usuários vinculados.
                {hasAssociations && (
                  <span className="mt-1.5 block font-semibold text-nok">
                    Esta obra possui {initialAmbientes.length} ambiente(s), {obraEquipes.length} equipe(s) e {totalUsuariosVinculados} usuário(s) vinculado(s).
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setConfirmDelete({ id: obraId, name: obra?.nome ?? '' })}
                disabled={hasAssociations || isPending}
                title={hasAssociations ? 'Obra possui registros associados' : 'Excluir obra'}
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-nok px-4 text-[13px] font-bold text-white transition-colors hover:bg-nok/90 disabled:cursor-not-allowed disabled:bg-bg-0 disabled:text-txt-3"
              >
                <Trash2 size={15} /> Excluir obra
              </button>
            </div>
          </div>
        </section>
      )}

      {isAmbienteModalOpen && (
        <AmbienteModal
          isOpen={isAmbienteModalOpen}
          onClose={() => setIsAmbienteModalOpen(false)}
          obraId={obraId}
          fvsPadraoList={fvsPadraoList}
        />
      )}

      {isEquipeModalOpen && (
        <ObraEquipeModal
          isOpen={isEquipeModalOpen}
          onClose={() => setIsEquipeModalOpen(false)}
          obraId={obraId}
          availableEquipes={availableEquipes}
          totalEmpresaEquipes={totalEmpresaEquipes}
        />
      )}

      <ObraModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        empresas={empresas}
        initialData={editInitialData}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteObra}
        title="Excluir Obra"
        message={`Tem certeza que deseja excluir "${confirmDelete?.name}"? Esta ação é permanente e não pode ser desfeita.`}
        confirmText="Sim, Excluir"
        variant="danger"
        isLoading={isPending}
      />

      <ConfirmDialog
        isOpen={!!confirmAmbienteDelete}
        onClose={() => setConfirmAmbienteDelete(null)}
        onConfirm={handleDeleteAmbiente}
        title="Excluir Ambiente"
        message={`Tem certeza que deseja excluir o ambiente "${confirmAmbienteDelete?.name}"? As FVS vinculadas sem verificações também serão excluídas. Esta ação é permanente.`}
        confirmText="Sim, Excluir"
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
