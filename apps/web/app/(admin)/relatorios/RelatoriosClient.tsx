'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Building2,
  Download,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Eye,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Obra {
  id: string;
  nome: string;
}

interface Fvs {
  id: string;
  subservico: string | null;
  status: string;
}

interface CardProps {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  action?: () => void;
  actionLabel?: string;
  disabled?: boolean;
  accent?: string;
  actionIcon?: ReactNode;
}

function ReportCard({
  icon,
  title,
  description,
  children,
  action,
  actionLabel = 'Exportar',
  disabled = false,
  accent = 'var(--prumo-brand)',
  actionIcon,
}: CardProps) {
  return (
    <section className="prumo-panel relative flex flex-col overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />
      <div className="flex-1 p-5 pl-6">
        <div
          className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${accent} 11%, transparent)`, color: accent }}
        >
          {icon}
        </div>
        <h2 className="mb-1 text-lg font-semibold tracking-[-.02em] text-txt">{title}</h2>
        <p className="mb-5 text-sm leading-relaxed text-txt-2">{description}</p>
        {children}
      </div>
      <button
        type="button"
        onClick={action}
        disabled={disabled || !action}
        className="flex w-full items-center justify-center gap-2 border-t border-brd-0 py-4 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        style={
          !disabled && action
            ? { background: accent, color: 'white' }
            : { background: 'var(--bg-2)', color: 'var(--txt-3)' }
        }
      >
        {actionIcon ?? <Download size={16} />}
        {actionLabel}
      </button>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-txt-2">
      {children}
    </label>
  );
}

function ObraSelect({
  obras,
  value,
  onChange,
  optional = false,
}: {
  obras: Obra[];
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <FieldLabel>Obra{optional ? ' (opcional)' : ''}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="prumo-field bg-bg-0"
      >
        <option value="">{optional ? 'Todas as obras' : 'Selecione uma obra'}</option>
        {obras.map((obra) => (
          <option key={obra.id} value={obra.id}>
            {obra.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateRange({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>De</FieldLabel>
        <input
          type="date"
          value={from}
          onChange={(event) => onFrom(event.target.value)}
          className="prumo-field bg-bg-0"
        />
      </div>
      <div>
        <FieldLabel>Até</FieldLabel>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onTo(event.target.value)}
          className="prumo-field bg-bg-0"
        />
      </div>
    </div>
  );
}

function exportUrl(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)),
  );
  window.open(`/admin${path}?${query.toString()}`, '_blank', 'noreferrer');
}

export default function RelatoriosClient({ obras }: { obras: Obra[] }) {
  const [obraFvs, setObraFvs] = useState('');
  const [fromFvs, setFromFvs] = useState('');
  const [toFvs, setToFvs] = useState('');
  const [fvsAttachments, setFvsAttachments] = useState(true);
  const [obraNc, setObraNc] = useState('');
  const [fromNc, setFromNc] = useState('');
  const [toNc, setToNc] = useState('');
  const [obraProgress, setObraProgress] = useState('');
  const [obraProductivity, setObraProductivity] = useState('');
  const [fromProductivity, setFromProductivity] = useState('');
  const [toProductivity, setToProductivity] = useState('');
  const [obraIndividual, setObraIndividual] = useState('');
  const [fvsList, setFvsList] = useState<Fvs[]>([]);
  const [fvsId, setFvsId] = useState('');
  const [individualAttachments, setIndividualAttachments] = useState(true);
  const [loadingFvs, setLoadingFvs] = useState(false);
  const [fvsError, setFvsError] = useState('');

  const invalidFvsPeriod = useMemo(
    () => Boolean(fromFvs && toFvs && fromFvs > toFvs),
    [fromFvs, toFvs],
  );
  const invalidNcPeriod = Boolean(fromNc && toNc && fromNc > toNc);
  const invalidProductivityPeriod = Boolean(
    fromProductivity && toProductivity && fromProductivity > toProductivity,
  );

  useEffect(() => {
    let cancelled = false;
    setFvsId('');
    setFvsList([]);
    setFvsError('');
    if (!obraIndividual) return;

    setLoadingFvs(true);
    const supabase = createClient();
    void (async () => {
      const { data: environments, error: environmentsError } = await supabase
        .from('ambientes')
        .select('id')
        .eq('obra_id', obraIndividual);
      if (environmentsError) {
        if (!cancelled) {
          setFvsError('Não foi possível carregar as FVS desta obra.');
          setLoadingFvs(false);
        }
        return;
      }

      const environmentIds = ((environments ?? []) as Array<{ id: string }>).map(
        (environment) => environment.id,
      );
      if (!environmentIds.length) {
        if (!cancelled) setLoadingFvs(false);
        return;
      }

      const { data, error } = await supabase
        .from('fvs_planejadas')
        .select('id, subservico, status')
        .in('ambiente_id', environmentIds)
        .order('subservico');
      if (!cancelled) {
        setFvsList((data ?? []) as Fvs[]);
        setFvsError(error ? 'Não foi possível carregar as FVS desta obra.' : '');
        setLoadingFvs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [obraIndividual]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      <ReportCard
        icon={<FileText size={20} />}
        title="Relatório de FVS"
        description="Reúne em um único PDF todas as verificações de uma obra dentro do período informado."
        action={() =>
          exportUrl('/relatorios/preview/fvs', {
            obraId: obraFvs,
            from: fromFvs,
            to: toFvs,
            attachments: fvsAttachments ? '1' : '0',
          })
        }
        actionLabel="Visualizar PDF"
        actionIcon={<Eye size={16} />}
        disabled={!obraFvs || invalidFvsPeriod}
      >
        <div className="space-y-3">
          <ObraSelect obras={obras} value={obraFvs} onChange={setObraFvs} />
          <DateRange
            from={fromFvs}
            to={toFvs}
            onFrom={setFromFvs}
            onTo={setToFvs}
          />
          <label className="flex items-center gap-2 text-sm text-txt-2">
            <input
              type="checkbox"
              checked={fvsAttachments}
              onChange={(event) => setFvsAttachments(event.target.checked)}
              className="h-4 w-4 accent-[var(--prumo-brand)]"
            />
            Incluir anexos fotográficos
          </label>
          {invalidFvsPeriod && (
            <p className="text-xs text-[var(--nok)]">A data inicial deve ser anterior à final.</p>
          )}
        </div>
      </ReportCard>

      <ReportCard
        icon={<FileSpreadsheet size={20} />}
        title="Não conformidades"
        description="Exporta a relação de NCs, responsáveis, prioridades, prazos e status para Excel."
        accent="var(--prumo-danger)"
        action={() =>
          exportUrl('/relatorios/export/ncs', {
            obraId: obraNc,
            from: fromNc,
            to: toNc,
          })
        }
        actionLabel="Exportar Excel"
        disabled={invalidNcPeriod}
      >
        <div className="space-y-3">
          <ObraSelect
            obras={obras}
            value={obraNc}
            onChange={setObraNc}
            optional
          />
          <DateRange
            from={fromNc}
            to={toNc}
            onFrom={setFromNc}
            onTo={setToNc}
          />
          {invalidNcPeriod && (
            <p className="text-xs text-[var(--nok)]">A data inicial deve ser anterior à final.</p>
          )}
        </div>
      </ReportCard>

      <ReportCard
        icon={<Building2 size={20} />}
        title="Progresso de obras"
        description="Exporta os totais de ambientes, FVS concluídas, progresso e NCs abertas por obra."
        accent="var(--prumo-info)"
        action={() =>
          exportUrl('/relatorios/export/progresso', { obraId: obraProgress })
        }
        actionLabel="Exportar Excel"
      >
        <ObraSelect
          obras={obras}
          value={obraProgress}
          onChange={setObraProgress}
          optional
        />
      </ReportCard>

      <ReportCard
        icon={<FileSearch size={20} />}
        title="Ficha FVS individual"
        description="Gera a ficha completa de uma FVS, com checklist, NCs, evidências e assinaturas."
        action={() =>
          window.open(
            `/admin/relatorio/fvs/${fvsId}?attachments=${individualAttachments ? '1' : '0'}`,
            '_blank',
            'noreferrer',
          )
        }
        actionLabel="Visualizar PDF"
        actionIcon={<Eye size={16} />}
        disabled={!fvsId}
      >
        <div className="space-y-3">
          <ObraSelect
            obras={obras}
            value={obraIndividual}
            onChange={setObraIndividual}
          />
          {obraIndividual && (
            <div>
              <FieldLabel>FVS</FieldLabel>
              <select
                value={fvsId}
                onChange={(event) => setFvsId(event.target.value)}
                disabled={loadingFvs || !fvsList.length}
                className="w-full rounded border border-brd-1 bg-bg-0 px-3 py-2 text-sm outline-none focus:border-[var(--br)] disabled:opacity-60"
              >
                <option value="">
                  {loadingFvs
                    ? 'Carregando...'
                    : fvsList.length
                      ? 'Selecione uma FVS'
                      : 'Nenhuma FVS encontrada'}
                </option>
                {fvsList.map((fvs) => (
                  <option key={fvs.id} value={fvs.id}>
                    {fvs.subservico || 'FVS sem nome'}
                  </option>
                ))}
              </select>
              {fvsError && (
                <p className="mt-2 text-xs text-[var(--nok)]">{fvsError}</p>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-txt-2">
            <input
              type="checkbox"
              checked={individualAttachments}
              onChange={(event) =>
                setIndividualAttachments(event.target.checked)
              }
              className="h-4 w-4 accent-[var(--prumo-brand)]"
            />
            Incluir anexos fotográficos
          </label>
        </div>
      </ReportCard>

      <ReportCard
        icon={<Users size={20} />}
        title="Produtividade das equipes"
        description="Consolida verificações, conformidades, avanço médio e obras atendidas por equipe."
        accent="var(--prumo-success)"
        action={() =>
          exportUrl('/relatorios/export/produtividade', {
            obraId: obraProductivity,
            from: fromProductivity,
            to: toProductivity,
          })
        }
        actionLabel="Exportar Excel"
        disabled={invalidProductivityPeriod}
      >
        <div className="space-y-3">
          <ObraSelect
            obras={obras}
            value={obraProductivity}
            onChange={setObraProductivity}
            optional
          />
          <DateRange
            from={fromProductivity}
            to={toProductivity}
            onFrom={setFromProductivity}
            onTo={setToProductivity}
          />
        </div>
      </ReportCard>

      <ReportCard
        icon={<BarChart3 size={20} />}
        title="Análises avançadas"
        description="Comparativos históricos, tendências e indicadores preditivos serão adicionados em uma próxima etapa."
        accent="var(--prumo-muted)"
        actionLabel="Em breve"
        disabled
      />
    </div>
  );
}
