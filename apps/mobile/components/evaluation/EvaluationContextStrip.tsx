import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  HardHat,
  LockKeyhole,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, InlineDateField, SelectField, SelectOption } from '../ui';
import { Colors, Elevation, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../lib/constants';

interface Props {
  /** True when the evaluation was opened from a medição, which already names
   * the obra and the contractor — only the model stays open to choice. */
  fromMeasurement: boolean;
  measurementReference?: string;

  works: SelectOption[];
  workId: string;
  onWorkChange: (id: string) => void;
  workError?: string;

  teams: SelectOption[];
  teamId: string;
  onTeamChange: (id: string) => void;
  teamError?: string;

  models: SelectOption[];
  modelId: string;
  onModelChange: (id: string) => void;
  modelError?: string;
  /** True when editing an existing avaliação — the model/revision the criteria
   * were answered against can't change mid-edit, so the field reads as a
   * confirmation instead of a picker. */
  modelLocked?: boolean;

  date: string;
  onDateChange: (value: string) => void;
}

/**
 * Collapsible "onde/quem/qual modelo" header for the evaluation. Once the
 * context is settled it holds a single summary line; it opens on demand, and
 * forces itself open when validation flags a field the summary would hide.
 */
export function EvaluationContextStrip({
  fromMeasurement,
  measurementReference,
  works,
  workId,
  onWorkChange,
  workError,
  teams,
  teamId,
  onTeamChange,
  teamError,
  models,
  modelId,
  onModelChange,
  modelError,
  modelLocked = false,
  date,
  onDateChange,
}: Props) {
  const [expanded, setExpanded] = useState(!fromMeasurement);

  const contextError = workError ?? teamError ?? modelError;
  useEffect(() => {
    if (contextError) setExpanded(true);
  }, [contextError]);

  const workLabel = works.find(option => option.id === workId)?.label ?? 'Obra pendente';
  const teamLabel = teams.find(option => option.id === teamId)?.label ?? 'Empreiteiro pendente';
  const modelLabel = models.find(option => option.id === modelId)?.label ?? 'Modelo pendente';

  return (
    <View style={styles.card}>
      <View style={styles.datum} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Contexto da avaliação: ${workLabel}, ${teamLabel}, ${modelLabel}. ${expanded ? 'Recolher' : 'Expandir'}.`}
        onPress={() => setExpanded(value => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <View style={styles.icon}>
          <ClipboardList size={18} color={Colors.brand} strokeWidth={2.2} />
        </View>
        <View style={styles.headerBody}>
          <Text numberOfLines={1} style={styles.name}>{teamLabel}</Text>
          <Text numberOfLines={1} style={styles.meta}>
            {workLabel}
            {measurementReference ? <Text style={styles.metaMono}>{` · ${measurementReference}`}</Text> : null}
          </Text>
        </View>
        {contextError ? (
          <Badge tone="danger" size="sm" label="Pendente" Icon={AlertCircle} />
        ) : fromMeasurement ? (
          <Badge tone="success" size="sm" label="Da medição" Icon={LockKeyhole} />
        ) : null}
        {expanded
          ? <ChevronUp size={18} color={Colors.textSecondary} />
          : <ChevronDown size={18} color={Colors.textSecondary} />}
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.hairline} />
          <SelectField
            label="Obra"
            Icon={Building2}
            value={workId}
            options={works}
            onChange={onWorkChange}
            locked={fromMeasurement}
            lockedLabel="Da medição"
            error={workError}
            emptyText="Nenhuma obra disponível."
            modalDescription="Escolha a obra onde a avaliação foi realizada."
          />
          <SelectField
            label="Empreiteiro"
            Icon={HardHat}
            value={teamId}
            options={teams}
            onChange={onTeamChange}
            locked={fromMeasurement}
            lockedLabel="Da medição"
            error={teamError}
            emptyText={workId ? 'Nenhuma equipe terceirizada nesta obra.' : 'Selecione a obra primeiro.'}
            modalDescription="Somente equipes terceirizadas ativas vinculadas a esta obra."
          />
          <SelectField
            label="Modelo de avaliação"
            Icon={ClipboardList}
            value={modelId}
            options={models}
            onChange={onModelChange}
            locked={modelLocked}
            lockedLabel="Da avaliação"
            error={modelError}
            emptyText="Nenhum modelo ativo para esta empresa."
            modalDescription="Os critérios e pesos vêm da revisão publicada do modelo."
          />
          <InlineDateField
            label="Data da avaliação"
            value={date}
            onChange={onDateChange}
            accessibilityLabel="Data da avaliação"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  datum: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: Colors.brandSignature,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingLeft: Spacing.lg + 3,
  },
  headerPressed: { backgroundColor: Colors.surface2 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandLight,
    borderWidth: 1,
    borderColor: Colors.brandSignature,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...Typography.label, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  metaMono: { fontFamily: FontFamily.mono, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingLeft: Spacing.lg + 3,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: Spacing.xs },
});
