import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  HardHat,
  History,
  MapPin,
  RotateCcw,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import PhotoGallery from '@/components/ui/PhotoGallery';
import StatusBadge from '@/components/ui/StatusBadge';
import { signPrivateMedia } from '@/lib/media/signed-urls';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@prumoq/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import NcFinancialPanel from './NcFinancialPanel';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

type NcRecord = Database['public']['Tables']['nao_conformidades']['Row'];
type ReinspectionRecord = Database['public']['Tables']['nc_reinspecoes']['Row'];

interface VerificationItemRecord {
  id: string;
  titulo: string;
  metodo_verif: string | null;
  tolerancia: string | null;
  resultado: string;
}

interface VerificationRecord {
  id: string;
  fvs_planejada_id: string;
  numero_verif: number;
  data_verif: string;
  inspetor_id: string;
  equipe_id: string | null;
  status: string;
  observacoes: string | null;
}

interface PlannedFvsRecord {
  id: string;
  ambiente_id: string;
  subservico: string;
}

interface EnvironmentRecord {
  id: string;
  obra_id: string;
  nome: string;
  tipo: string | null;
  localizacao: string | null;
}

interface WorkRecord {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  eng_responsavel: string;
  crea_cau: string;
  controle_financeiro_nc_efetivo: boolean;
}

interface UserRecord {
  id: string;
  nome: string;
  cargo: string | null;
}

interface TeamRecord {
  id: string;
  nome: string;
  responsavel: string | null;
  especialidade: string | null;
}

interface PhotoRecord {
  id: string;
  r2_key: string;
  r2_thumb_key: string | null;
  nome_arquivo: string | null;
  ordem: number;
}

interface RelatedOccurrenceRecord {
  id: string;
  numero_ocorrencia: number;
  status: string;
  descricao: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Não informada';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function priorityLabel(priority: string): string {
  if (priority === 'alta') return 'Alta';
  if (priority === 'media') return 'Média';
  if (priority === 'baixa') return 'Baixa';
  return 'Não informada';
}

function statusLabel(status: string): string {
  if (status === 'aberta') return 'Aberta';
  if (status === 'em_correcao') return 'Em correção';
  if (status === 'resolvida') return 'Resolvida';
  if (status === 'cancelada') return 'Cancelada';
  return status.replaceAll('_', ' ');
}

function deadlineMeta(value: string | null, status: string): { label: string; className: string } {
  if (!value) return { label: 'Sem prazo', className: 'text-txt-2' };
  if (status === 'resolvida' || status === 'cancelada') {
    return { label: formatDate(value), className: 'text-txt' };
  }
  const due = new Date(`${value.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: `Vencida há ${Math.abs(diff)}d`, className: 'text-nok' };
  if (diff === 0) return { label: 'Vence hoje', className: 'text-nok' };
  if (diff <= 3) return { label: `Vence em ${diff}d`, className: 'text-warn' };
  return { label: formatDate(value), className: 'text-txt' };
}

export default async function NcDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ncData, error: ncError } = await supabase
    .from('nao_conformidades')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const nc = ncData as unknown as NcRecord | null;

  if (ncError || !nc) notFound();

  const [
    itemResult,
    verificationResult,
    responsibleResult,
    photosResult,
    reinspectionsResult,
    previousResult,
    nextResult,
  ] = await Promise.all([
    supabase
      .from('verificacao_itens')
      .select('id, titulo, metodo_verif, tolerancia, resultado')
      .eq('id', nc.verificacao_item_id)
      .maybeSingle(),
    supabase
      .from('verificacoes')
      .select('id, fvs_planejada_id, numero_verif, data_verif, inspetor_id, equipe_id, status, observacoes')
      .eq('id', nc.verificacao_id)
      .maybeSingle(),
    nc.responsavel_id
      ? supabase.from('equipes').select('id, nome, responsavel, especialidade').eq('id', nc.responsavel_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('nc_fotos')
      .select('id, r2_key, r2_thumb_key, nome_arquivo, ordem')
      .eq('nc_id', id)
      .order('ordem'),
    supabase
      .from('nc_reinspecoes')
      .select('id, verificacao_id, inspetor_id, resultado, observacao, foto_url, nova_nc_id, created_at')
      .eq('nc_id', id)
      .order('created_at'),
    nc.nc_anterior_id
      ? supabase
        .from('nao_conformidades')
        .select('id, numero_ocorrencia, status, descricao')
        .eq('id', nc.nc_anterior_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('nao_conformidades')
      .select('id, numero_ocorrencia, status, descricao')
      .eq('nc_anterior_id', id)
      .order('numero_ocorrencia'),
  ]);

  const item = itemResult.data as unknown as VerificationItemRecord | null;
  const verification = verificationResult.data as unknown as VerificationRecord | null;
  const responsible = responsibleResult.data as unknown as TeamRecord | null;
  const photoRows = (photosResult.data ?? []) as unknown as PhotoRecord[];
  const reinspections = (reinspectionsResult.data ?? []) as unknown as ReinspectionRecord[];
  const previous = previousResult.data as unknown as RelatedOccurrenceRecord | null;
  const nextOccurrences = (nextResult.data ?? []) as unknown as RelatedOccurrenceRecord[];
  if (!item || !verification) notFound();

  const { data: plannedFvsData } = await supabase
    .from('fvs_planejadas')
    .select('id, ambiente_id, subservico')
    .eq('id', verification.fvs_planejada_id)
    .maybeSingle();
  const plannedFvs = plannedFvsData as unknown as PlannedFvsRecord | null;
  if (!plannedFvs) notFound();

  const [
    environmentResult,
    inspectorResult,
    executionTeamResult,
  ] = await Promise.all([
    supabase
      .from('ambientes')
      .select('id, obra_id, nome, tipo, localizacao')
      .eq('id', plannedFvs.ambiente_id)
      .maybeSingle(),
    supabase
      .from('usuarios')
      .select('id, nome, cargo')
      .eq('id', verification.inspetor_id)
      .maybeSingle(),
    verification.equipe_id
      ? supabase
        .from('equipes')
        .select('id, nome, responsavel, especialidade')
        .eq('id', verification.equipe_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const environment = environmentResult.data as unknown as EnvironmentRecord | null;
  const inspector = inspectorResult.data as unknown as UserRecord | null;
  const executionTeam = executionTeamResult.data as unknown as TeamRecord | null;
  if (!environment) notFound();

  const { data: workData } = await supabase
    .from('obras')
    .select('id, nome, municipio, uf, eng_responsavel, crea_cau, controle_financeiro_nc_efetivo')
    .eq('id', environment.obra_id)
    .maybeSingle();
  const work = workData as unknown as WorkRecord | null;
  if (!work) notFound();

  const inspectorIds = Array.from(new Set(reinspections.map(row => row.inspetor_id)));
  const verificationIds = Array.from(new Set(reinspections.map(row => row.verificacao_id)));
  const [reinspectionInspectorsResult, reinspectionVerificationsResult] = await Promise.all([
    inspectorIds.length
      ? supabase.from('usuarios').select('id, nome').in('id', inspectorIds)
      : Promise.resolve({ data: [], error: null }),
    verificationIds.length
      ? supabase.from('verificacoes').select('id, numero_verif').in('id', verificationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const reinspectionInspectors = (reinspectionInspectorsResult.data ?? []) as unknown as Pick<UserRecord, 'id' | 'nome'>[];
  const reinspectionVerifications = (reinspectionVerificationsResult.data ?? []) as unknown as Pick<VerificationRecord, 'id' | 'numero_verif'>[];
  const inspectorsById = new Map(reinspectionInspectors.map(row => [row.id, row.nome]));
  const verificationsById = new Map(reinspectionVerifications.map(row => [row.id, row.numero_verif]));

  const signedMedia = await signPrivateMedia(
    supabase as unknown as SupabaseClient<Database>,
    [
      ...photoRows.flatMap(photo => [photo.r2_key, photo.r2_thumb_key]),
      ...reinspections.map(reinspection => reinspection.foto_url),
      nc.foto_reinspecao_url,
    ],
  );

  const deadline = deadlineMeta(nc.data_nova_verif, nc.status);
  const isOpen = nc.status === 'aberta' || nc.status === 'em_correcao';
  const photos = photoRows.map(photo => ({
    r2_key: signedMedia.get(photo.r2_key) ?? '',
    r2_thumb_key: photo.r2_thumb_key ? signedMedia.get(photo.r2_thumb_key) : undefined,
    caption: photo.nome_arquivo ?? 'Evidência da não conformidade',
  })).filter(photo => Boolean(photo.r2_key));
  const [{ data: financialUsers }, { data: financialHistory }] = work.controle_financeiro_nc_efetivo
    ? await Promise.all([
      supabase.from('usuarios').select('id,nome').in('perfil', ['admin', 'gestor']).order('nome'),
      supabase.from('nc_financeiro_historico').select('id,situacao,bloqueio,created_at,alterado_por').eq('nc_id', nc.id).order('created_at', { ascending: false }),
    ])
    : [{ data: [] }, { data: [] }];
  return (
    <>
      <Header
        breadcrumbs={[
          { label: 'Não Conformidades', href: '/nc' },
          { label: `Ocorrência ${nc.numero_ocorrencia}` },
        ]}
      />
      <main className="prumo-page">
        <div className="prumo-page-inner space-y-5">
          <section className="overflow-hidden rounded-2xl border border-brd-0 bg-bg-1">
            <div className="h-1 bg-nok" />
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between md:p-6">
              <div className="min-w-0">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.9px] text-nok">
                  Item não conforme
                </div>
                <h1 className="text-balance text-2xl font-semibold leading-tight text-txt">
                  {item.titulo}
                </h1>
                <p className="mt-2 text-sm text-txt-2">
                  {plannedFvs.subservico} · {work.nome} · {environment.nome}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                <StatusBadge status={nc.status} size="md" />
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  nc.prioridade === 'alta'
                    ? 'border-nok/20 bg-nok-bg text-nok'
                    : nc.prioridade === 'media'
                      ? 'border-warn/20 bg-warn-bg text-warn'
                      : 'border-brd-1 bg-bg-0 text-txt-2'
                }`}>
                  <ShieldCheck size={13} />
                  Prioridade {priorityLabel(nc.prioridade).toLocaleLowerCase('pt-BR')}
                </span>
              </div>
            </div>
            <div className="grid border-t border-brd-0 bg-bg-0 sm:grid-cols-3">
              <HeroFact icon={<CalendarDays size={16} />} label="Prazo" value={deadline.label} valueClassName={deadline.className} />
              <HeroFact icon={<UsersRound size={16} />} label="Responsável" value={responsible?.nome ?? 'Não informado'} />
              <HeroFact icon={<Clock3 size={16} />} label="Situação" value={isOpen ? 'Aguardando correção / reinspeção' : statusLabel(nc.status)} />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <Panel eyebrow="Ocorrência" title="Problema e encaminhamento" icon={<AlertTriangle size={18} />}>
                <div className="rounded-lg border-l-[3px] border-l-nok bg-nok-bg p-4">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.7px] text-nok">Descrição</div>
                  <p className="text-sm font-medium leading-6 text-txt">{nc.descricao}</p>
                </div>
                <Detail label="Solução proposta" value={nc.solucao_proposta} />
              </Panel>

              <Panel eyebrow="Evidências" title="Registro fotográfico" icon={<Camera size={18} />}>
                {photos.length ? (
                  <PhotoGallery photos={photos} />
                ) : (
                  <EmptyMessage>Nenhuma foto foi anexada à ocorrência.</EmptyMessage>
                )}
              </Panel>

              <Panel eyebrow="Histórico" title="Ciclo da não conformidade" icon={<History size={18} />}>
                <div>
                  <TimelineItem
                    title="Não conformidade registrada"
                    date={formatDateTime(nc.created_at)}
                    description="Ocorrência aberta a partir da verificação de serviço."
                    tone="danger"
                    last={!reinspections.length && !nc.resolvida_em}
                  />
                  {reinspections.map((reinspection, index) => {
                    const approved = reinspection.resultado === 'aprovada';
                    const isLast = index === reinspections.length - 1 && !nc.resolvida_em;
                    return (
                      <TimelineItem
                        key={reinspection.id}
                        title={approved ? 'Reinspeção aprovada' : 'Reinspeção reprovada'}
                        date={formatDateTime(reinspection.created_at)}
                        description={reinspection.observacao || 'Sem observações adicionais.'}
                        meta={`${inspectorsById.get(reinspection.inspetor_id) ?? 'Inspetor não informado'} · verificação ${verificationsById.get(reinspection.verificacao_id) ?? '—'}`}
                        tone={approved ? 'success' : 'warning'}
                        last={isLast}
                      >
                        {reinspection.foto_url && signedMedia.has(reinspection.foto_url) ? (
                          <div className="mt-3 max-w-[280px]">
                            <PhotoGallery photos={[{
                              r2_key: signedMedia.get(reinspection.foto_url)!,
                              caption: 'Evidência da reinspeção',
                            }]} />
                          </div>
                        ) : null}
                        {reinspection.nova_nc_id ? (
                          <Link
                            href={`/nc/${reinspection.nova_nc_id}`}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--br)] hover:underline"
                          >
                            Ver ocorrência gerada
                            <RotateCcw size={13} />
                          </Link>
                        ) : null}
                      </TimelineItem>
                    );
                  })}
                  {nc.resolvida_em ? (
                    <TimelineItem
                      title="Ocorrência resolvida"
                      date={formatDateTime(nc.resolvida_em)}
                      description={nc.observacao_resolucao || 'Encerrada após reinspeção conforme.'}
                      tone="success"
                      last
                    >
                      {nc.foto_reinspecao_url && signedMedia.has(nc.foto_reinspecao_url) ? (
                        <div className="mt-3 max-w-[280px]">
                          <PhotoGallery photos={[{
                            r2_key: signedMedia.get(nc.foto_reinspecao_url)!,
                            caption: 'Evidência de encerramento',
                          }]} />
                        </div>
                      ) : null}
                    </TimelineItem>
                  ) : null}
                </div>
              </Panel>

              {(previous || nextOccurrences.length) ? (
                <Panel eyebrow="Recorrência" title="Ocorrências relacionadas" icon={<RotateCcw size={18} />}>
                  <div className="divide-y divide-brd-0 overflow-hidden rounded-lg border border-brd-0">
                    {previous ? <RelatedOccurrence prefix="Anterior" occurrence={previous} /> : null}
                    {nextOccurrences.map(occurrence => (
                      <RelatedOccurrence key={occurrence.id} prefix="Seguinte" occurrence={occurrence} />
                    ))}
                  </div>
                </Panel>
              ) : null}
            </div>

            <aside className="space-y-5">
              <Panel eyebrow="Contexto" title="Origem da ocorrência" icon={<ClipboardCheck size={18} />}>
                <SideFact icon={<HardHat size={16} />} label="Obra" value={work.nome} />
                <SideFact
                  icon={<MapPin size={16} />}
                  label="Ambiente"
                  value={[environment.nome, environment.localizacao].filter(Boolean).join(' · ')}
                />
                <SideFact icon={<Wrench size={16} />} label="Serviço" value={plannedFvs.subservico} />
                <SideFact
                  icon={<ClipboardCheck size={16} />}
                  label="Verificação de origem"
                  value={`Nº ${verification.numero_verif} · ${formatDate(verification.data_verif)}`}
                />
                <SideFact
                  icon={<UserRound size={16} />}
                  label="Inspetor"
                  value={[
                    inspector?.nome,
                    inspector?.cargo,
                  ].filter(Boolean).join(' · ') || 'Não informado'}
                />
                <SideFact
                  icon={<UsersRound size={16} />}
                  label="Equipe executora"
                  value={executionTeam?.nome ?? 'Não informada'}
                  last
                />
              </Panel>

              <Panel eyebrow="Critério" title="Item verificado" icon={<ShieldCheck size={18} />}>
                <Detail label="Item" value={item.titulo} compact />
                <Detail label="Método" value={item.metodo_verif || 'Não informado'} compact />
                <Detail label="Tolerância / critério" value={item.tolerancia || 'Não informado'} compact />
                <Detail label="Resultado original" value={item.resultado.replaceAll('_', ' ')} compact />
              </Panel>

              <Panel eyebrow="Responsabilidade" title="Correção programada" icon={<UsersRound size={18} />}>
                <Detail label="Equipe" value={responsible?.nome ?? 'Não informada'} compact />
                <Detail label="Responsável da equipe" value={responsible?.responsavel ?? 'Não informado'} compact />
                <Detail label="Especialidade" value={responsible?.especialidade ?? 'Não informada'} compact />
                <Detail label="Data prevista" value={formatDate(nc.data_nova_verif)} compact />
              </Panel>

              {work.controle_financeiro_nc_efetivo ? (
                <NcFinancialPanel
                  ncId={nc.id}
                  initial={{
                    situacao: nc.situacao_financeira ?? undefined,
                    bloqueio: nc.bloqueio_medicao ?? undefined,
                    justificativaSemImpacto: nc.justificativa_sem_impacto,
                    responsavelAvaliacaoId: nc.responsavel_avaliacao_id,
                    prazoAvaliacao: nc.prazo_avaliacao,
                    valorEstimado: nc.valor_estimado,
                    valorConfirmado: nc.valor_confirmado,
                    responsavelFinanceiro: nc.responsavel_financeiro,
                    categoriaFinanceira: nc.categoria_financeira,
                    valorBloqueado: nc.valor_bloqueado,
                    observacao: nc.observacao_financeira,
                    documento: nc.documento_financeiro_r2_key,
                  }}
                  users={financialUsers ?? []}
                  history={financialHistory ?? []}
                />
              ) : null}

              <section className="rounded-xl border border-brd-0 bg-bg-1 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-txt-3">Auditoria</div>
                <dl className="mt-3 space-y-3 text-xs">
                  <AuditFact label="ID do registro" value={nc.id} mono />
                  <AuditFact label="Criada em" value={formatDateTime(nc.created_at)} />
                  <AuditFact label="Atualizada em" value={formatDateTime(nc.updated_at)} />
                  <AuditFact label="Ocorrência" value={String(nc.numero_ocorrencia)} />
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

function Panel({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brd-0 bg-bg-1 p-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bl)] text-[var(--br)]">
          {icon}
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-txt-3">{eyebrow}</div>
          <h2 className="text-[15px] font-semibold text-txt">{title}</h2>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function HeroFact({
  icon,
  label,
  value,
  valueClassName = 'text-txt',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-brd-0 px-5 py-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className="mt-0.5 text-txt-3">{icon}</span>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-txt-3">{label}</div>
        <div className={`mt-0.5 text-sm font-medium ${valueClassName}`}>{value}</div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'rounded-lg bg-bg-0 p-4'}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-txt-3">{label}</div>
      <p className={`${compact ? 'text-[13px]' : 'text-sm leading-6'} text-txt`}>{value}</p>
    </div>
  );
}

function SideFact({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex gap-3 pb-3 ${last ? '' : 'border-b border-brd-0'}`}>
      <span className="mt-0.5 text-txt-3">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.5px] text-txt-3">{label}</div>
        <div className="mt-0.5 text-[13px] font-medium text-txt">{value}</div>
      </div>
    </div>
  );
}

function TimelineItem({
  title,
  date,
  description,
  meta,
  tone,
  last = false,
  children,
}: {
  title: string;
  date: string;
  description: string;
  meta?: string;
  tone: 'danger' | 'warning' | 'success';
  last?: boolean;
  children?: React.ReactNode;
}) {
  const dotClass = tone === 'success' ? 'bg-ok' : tone === 'warning' ? 'bg-warn' : 'bg-nok';
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
      <div className="flex flex-col items-center">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-bg-1 ${dotClass}`} />
        {!last ? <span className="min-h-12 w-px flex-1 bg-brd-1" /> : null}
      </div>
      <div className={last ? '' : 'pb-6'}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-txt">{title}</h3>
          <time className="font-mono text-[10px] text-txt-3">{date}</time>
        </div>
        {meta ? <p className="mt-1 text-xs font-medium text-txt-2">{meta}</p> : null}
        <p className="mt-1 text-xs leading-5 text-txt-2">{description}</p>
        {children}
      </div>
    </div>
  );
}

function RelatedOccurrence({
  prefix,
  occurrence,
}: {
  prefix: string;
  occurrence: { id: string; numero_ocorrencia: number; status: string; descricao: string };
}) {
  return (
    <Link href={`/nc/${occurrence.id}`} className="flex items-center justify-between gap-4 bg-bg-1 p-4 hover:bg-bg-0">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-txt-3">{prefix}</div>
        <div className="mt-0.5 text-[13px] font-semibold text-txt">
          Ocorrência {occurrence.numero_ocorrencia} · {statusLabel(occurrence.status)}
        </div>
        <div className="mt-0.5 truncate text-xs text-txt-2">{occurrence.descricao}</div>
      </div>
      <RotateCcw size={16} className="shrink-0 text-[var(--br)]" />
    </Link>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-brd-1 bg-bg-0 px-4 py-8 text-center text-sm text-txt-3">
      {children}
    </div>
  );
}

function AuditFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-txt-3">{label}</dt>
      <dd className={`mt-0.5 break-all text-txt ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</dd>
    </div>
  );
}
