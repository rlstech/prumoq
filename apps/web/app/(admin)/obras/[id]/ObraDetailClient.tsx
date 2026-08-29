'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { HardHat, Pencil, Ruler, Trash2, AlertTriangle } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';
import { useRouter } from 'next/navigation';
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
    <div>
      <ObraFeatureControls
        obraId={obraId}
        medicionesOverride={obra.controle_medicoes_override ?? null}
        financeiroOverride={obra.controle_financeiro_nc_override ?? null}
        medicionesEffective={Boolean(obra.controle_medicoes_efetivo)}
        financeiroEffective={Boolean(obra.controle_financeiro_nc_efetivo)}
      />
      <div className="mb-6">
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Seções da obra"
          trailing={
            <button type="button" onClick={() => setIsEditModalOpen(true)} className="prumo-row-button">
              <Pencil size={13} /> Editar obra
            </button>
          }
        />
      </div>

      {/* Tab: Ambientes */}
      {activeTab === 'ambientes' && (
        <>
          <Tabs
            tabs={[
              { id: 'Todos', label: 'Todos', count: initialAmbientes.length },
              { id: 'Interno', label: 'Internos', count: initialAmbientes.filter(a => a.tipo === 'Interno').length },
              { id: 'Externo', label: 'Externos', count: initialAmbientes.filter(a => a.tipo === 'Externo').length },
              { id: 'Com NC', label: 'Com NC', count: initialAmbientes.filter(a => a.ncs_abertas > 0).length },
            ]}
            value={filterType}
            onChange={setFilterType}
            ariaLabel="Recorte de ambientes"
          />
          <div className="mt-4 mb-5">
            <FilterBar resultLabel={`${filtered.length} de ${initialAmbientes.length} ambientes`}>
              <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Buscar ambiente" className="w-full sm:w-64" />
            </FilterBar>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(amb => {
              const percent = amb.total_fvs > 0 ? Math.round((amb.fvs_concluidas / amb.total_fvs) * 100) : 0;
              const hasNC = amb.ncs_abertas > 0;
              return (
                <div
                  key={amb.id}
                  onClick={() => router.push(`/obras/${obraId}/ambiente/${amb.id}`)}
                  className="bg-bg-1 border border-brd-0 rounded-xl p-[14px] cursor-pointer hover:border-[var(--br)] hover:shadow-sm transition-all"
                  style={{ borderTopWidth: '3px', borderTopColor: hasNC ? 'var(--nok)' : amb.tipo === 'Interno' ? 'var(--pg)' : 'var(--ok)' }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-[13px] font-semibold text-txt">{amb.nome}</h4>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        hasNC ? 'bg-nok-bg text-nok' : percent >= 80 ? 'bg-ok-bg text-ok' : percent > 0 ? 'bg-pg-bg text-pg' : 'bg-na-bg text-na'
                      }`}>
                        {hasNC ? 'NC' : `${amb.fvs_concluidas}/${amb.total_fvs}`}
                      </span>
                      {!ambientesWithVerificacoes[amb.id] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmAmbienteDelete({ id: amb.id, name: amb.nome });
                          }}
                          title="Excluir ambiente"
                          className="p-1 text-txt-3 hover:text-nok hover:bg-nok-bg rounded-lg transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-txt-2 mt-1">{amb.tipo} · {amb.localizacao}</p>
                  <div className="mt-2.5">
                    <ProgressBar value={percent} variant={hasNC ? 'nok' : percent === 100 ? 'ok' : 'brand'} />
                  </div>
                </div>
              );
            })}

            {/* Card "Novo ambiente" */}
            <div
              onClick={() => setIsAmbienteModalOpen(true)}
              className="bg-bg-0 border-2 border-dashed border-brd-1 rounded-xl flex flex-col items-center justify-center min-h-[100px] cursor-pointer hover:border-[var(--br)] hover:bg-bg-1 transition-all gap-1.5"
            >
              <span className="text-xl text-txt-3">+</span>
              <span className="text-xs text-txt-3">Novo ambiente</span>
            </div>
          </div>
        </>
      )}

      {/* Tab: Equipe */}
      {activeTab === 'equipe' && (
        <div className="bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-brd-0 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-txt">Equipe da obra</h3>
            <button
              type="button"
              onClick={() => setIsEquipeModalOpen(true)}
              className="prumo-row-button"
            >
              + Adicionar
            </button>
          </div>

          {obraEquipes.length > 0 ? (
            obraEquipes.map(eq => {
              const isProprio = eq.tipo === 'proprio';
              const isRemoving = removingId === eq.id && isPending;
              return (
                <div key={eq.id} className="flex items-center gap-3 px-4 py-3 border-b border-brd-0 last:border-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    isProprio ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                  }`}>
                    {eq.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[13px] font-medium text-txt">{eq.nome}</h5>
                    <p className="text-xs text-txt-2 mt-0.5">{eq.especialidade || 'Geral'}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isProprio ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                  }`}>
                    {isProprio ? 'Próprio' : 'Terceirizado'}
                  </span>
                  <button
                    onClick={() => handleRemoveEquipe(eq.id)}
                    disabled={isRemoving}
                    title="Remover da obra"
                    className="p-1.5 text-txt-3 hover:text-nok hover:bg-nok-bg rounded-lg transition-colors disabled:opacity-40 ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center text-sm text-txt-3 flex flex-col items-center gap-2">
              <HardHat size={24} className="opacity-40" />
              {totalEmpresaEquipes === 0 ? (
                <>
                  <span>Nenhuma equipe cadastrada para esta empresa.</span>
                  <a
                    href="/equipes"
                    className="mt-1 text-xs text-[var(--br)] hover:underline font-medium"
                  >
                    Cadastrar equipes →
                  </a>
                </>
              ) : (
                <>
                  <span>Nenhuma equipe vinculada a esta obra.</span>
                  <button
                    onClick={() => setIsEquipeModalOpen(true)}
                    className="mt-1 text-xs text-[var(--br)] hover:underline font-medium"
                  >
                    + Adicionar equipe
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Medições */}
      {activeTab === 'medicoes' && (
        <div className="bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-brd-0 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-txt">Serviços com medição configurada</h3>
            {medicoesServices.length > 0 && (
              <span className="text-xs text-txt-2">{medicoesServices.length} serviço(s)</span>
            )}
          </div>

          {!medicoesEnabled ? (
            <div className="py-10 text-center text-sm text-txt-3 flex flex-col items-center gap-2">
              <Ruler size={24} className="opacity-40" />
              <span>O controle de medições está desativado nesta obra.</span>
              <span className="text-xs">Ative-o nos recursos opcionais da obra (seção acima).</span>
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
                  cell: svc => <div><div className="font-medium text-[13px] text-txt">{svc.subservico}</div><div className="text-xs text-txt-2">{svc.ambienteNome}</div></div>,
                },
                {
                  header: 'Método',
                  cell: svc => (
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      svc.metodo === 'quantidade' ? 'bg-pg-bg text-pg'
                      : svc.metodo === 'unidade_concluida' ? 'bg-ok-bg text-ok'
                      : 'bg-warn-bg text-warn'
                    }`}>
                      {metodoLabels[svc.metodo] ?? svc.metodo}
                    </span>
                  ),
                },
                { header: 'Previsto', align: 'right', cell: svc => <span className="text-[13px] text-txt">{fmt(svc.escopo || svc.quantidadeTotal)} {svc.unidade}</span> },
                { header: 'Aprovado', align: 'right', cell: svc => <span className="text-[13px] text-txt">{fmt(svc.aprovado)}</span> },
                { header: 'Disponível', align: 'right', cell: svc => <span className="text-[13px] font-medium text-ok">{fmt(svc.disponivel)}</span> },
                { header: 'Valor disponível', align: 'right', cell: svc => <span className="text-[13px] text-txt">{money(svc.valorDisponivel)}</span> },
                {
                  header: 'Empreiteiro',
                  cell: svc => <div><div className="text-[13px] text-txt">{svc.empreiteiro ?? '—'}</div>{svc.dataInicio && <div className="text-xs text-txt-3">desde {fmtDate(svc.dataInicio)}</div>}</div>,
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

      {/* Zona de Perigo — exclusão da obra */}
      {canDelete && (
        <section className="mt-8 border border-nok/30 rounded-xl bg-nok/5 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-nok/10 text-nok shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-semibold text-nok">Zona de Perigo</h3>
              <p className="text-xs text-txt-2 mt-1 leading-relaxed">
                A exclusão é <span className="font-medium">permanente</span> e não pode ser desfeita.
                A obra só pode ser excluída se não tiver ambientes, equipes ou usuários vinculados.
                {hasAssociations && (
                  <span className="block mt-1.5 text-nok">
                    Esta obra possui {initialAmbientes.length} ambiente(s), {obraEquipes.length} equipe(s) e {totalUsuariosVinculados} usuário(s) vinculado(s).
                  </span>
                )}
              </p>
              <button
                onClick={() => setConfirmDelete({ id: obraId, name: obra?.nome ?? '' })}
                disabled={hasAssociations || isPending}
                title={hasAssociations ? 'Obra possui registros associados' : 'Excluir obra'}
                className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                  hasAssociations
                    ? 'bg-bg-0 text-txt-3 cursor-not-allowed opacity-50'
                    : 'bg-nok text-white border-nok hover:bg-nok/90'
                }`}
              >
                <Trash2 size={13} /> Excluir obra
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
