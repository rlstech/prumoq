import { AlertCircle, Check, ChevronDown, ChevronRight, ChevronUp, LockKeyhole, Search, UsersRound, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Badge,
  DataRow,
  IconButton,
  InlineDateField,
  ModalSheet,
} from '../ui';
import { Colors, ComponentSize, Elevation, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../lib/constants';
import { EquipeRow, getInitials } from './types';

interface Props {
  inspectorName: string;
  dataVerif: string;
  onDataVerifChange: (value: string) => void;
  /** Teams offered by the picker — already resolved by the caller to either
   * the full active roster or, when the service is measurement-locked to
   * more than one team, just those teams. */
  pickerEquipes: EquipeRow[];
  selectedEquipe: EquipeRow | null;
  onSelectEquipe: (equipeId: string) => void;
  /** True when exactly one team is fixed by an active measurement link — no
   * picker is offered and the row reads as a confirmation, not a control. */
  equipeLockedSingle: boolean;
  /** Limits the picker to teams assigned to the active measurement. */
  equipeLocked: boolean;
  equipeError?: string;
}

/**
 * Collapsible "who/when" header for the verification's checklist step.
 * Replaces the old inspector card + form card pair with a single-line strip
 * when context is already known, expanding only when it needs attention.
 */
export function VerificationContextStrip({
  inspectorName,
  dataVerif,
  onDataVerifChange,
  pickerEquipes,
  selectedEquipe,
  onSelectEquipe,
  equipeLockedSingle,
  equipeLocked,
  equipeError,
}: Props) {
  const [expanded, setExpanded] = useState(!selectedEquipe);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'proprio' | 'terceirizado'>('all');

  // Force the strip open when validation flags a missing team — the error
  // would otherwise be invisible behind the collapsed summary line.
  useEffect(() => {
    if (equipeError) setExpanded(true);
  }, [equipeError]);

  const equipeLabel = selectedEquipe ? selectedEquipe.nome : 'Equipe pendente';
  const dateLabel = formatDateLabel(dataVerif);
  const normalizedSearch = normalize(search);
  const hasTypes = pickerEquipes.some(team => team.tipo === 'proprio' || team.tipo === 'terceirizado');
  const filteredEquipes = pickerEquipes.filter(team => (
    (filter === 'all' || team.tipo === filter)
    && (!normalizedSearch || normalize(team.nome).includes(normalizedSearch))
  ));
  const selectedVisible = filteredEquipes.find(team => team.id === selectedEquipe?.id);
  const remainingEquipes = filteredEquipes.filter(team => team.id !== selectedEquipe?.id);
  const ownTeams = remainingEquipes.filter(team => team.tipo === 'proprio');
  const contractorTeams = remainingEquipes.filter(team => team.tipo === 'terceirizado');
  const untypedTeams = remainingEquipes.filter(team => team.tipo !== 'proprio' && team.tipo !== 'terceirizado');

  const openPicker = () => {
    setSearch('');
    setFilter('all');
    setShowPicker(true);
  };

  const chooseTeam = (teamId: string) => {
    onSelectEquipe(teamId);
    setShowPicker(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.datum} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Contexto da verificação: ${inspectorName}, ${dateLabel}, ${equipeLabel}. ${expanded ? 'Recolher' : 'Expandir'}.`}
        onPress={() => setExpanded(value => !value)}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(inspectorName)}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text numberOfLines={1} style={styles.name}>{inspectorName}</Text>
          <Text numberOfLines={1} style={styles.meta}>
            <Text style={styles.metaMono}>{dateLabel}</Text>
            {' · '}
            {equipeLabel}
          </Text>
        </View>
        {equipeError ? (
          <Badge tone="danger" size="sm" label="Equipe" Icon={AlertCircle} />
        ) : equipeLockedSingle ? (
          <Badge tone="success" size="sm" label="Fixa" Icon={LockKeyhole} />
        ) : null}
        {expanded
          ? <ChevronUp size={18} color={Colors.textSecondary} />
          : <ChevronDown size={18} color={Colors.textSecondary} />}
      </Pressable>

      {expanded ? (
        <View style={styles.expandedBody}>
          <View style={styles.hairline} />
          <InlineDateField
            label="Data da verificação"
            value={dataVerif}
            onChange={onDataVerifChange}
            accessibilityLabel="Data da verificação"
          />
          {equipeLockedSingle ? (
            <DataRow
              label="Equipe executora"
              value={selectedEquipe?.nome ?? '—'}
              trailing={<Badge tone="success" size="sm" label="Fixa na medição" Icon={LockKeyhole} />}
              last
            />
          ) : (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Equipe executora</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedEquipe ? `Equipe executora: ${selectedEquipe.nome}` : 'Selecionar equipe executora'}
                accessibilityHint="Abre a lista de equipes disponíveis"
                onPress={openPicker}
                style={({ pressed }) => [
                  styles.teamTrigger,
                  selectedEquipe ? styles.teamTriggerSelected : styles.teamTriggerPending,
                  equipeError && styles.teamTriggerError,
                  pressed && styles.teamTriggerPressed,
                ]}
              >
                <View style={styles.teamTriggerDatum} />
                <View style={styles.teamTriggerIcon}>
                  <UsersRound size={19} color={selectedEquipe ? Colors.brand : Colors.textSecondary} strokeWidth={2} />
                </View>
                <View style={styles.teamTriggerBody}>
                  <Text numberOfLines={1} style={[styles.teamTriggerValue, !selectedEquipe && styles.teamTriggerPlaceholder]}>
                    {selectedEquipe?.nome ?? 'Selecionar equipe'}
                  </Text>
                  <Text style={styles.teamTriggerMeta}>
                    {selectedEquipe ? formatTeamType(selectedEquipe.tipo) : 'Obrigatória para registrar a vistoria'}
                  </Text>
                </View>
                {selectedEquipe ? <Check size={19} color={Colors.ok} strokeWidth={2.4} /> : null}
                <ChevronDown size={18} color={Colors.textSecondary} />
              </Pressable>
              {equipeError ? <Text style={styles.error}>{equipeError}</Text> : null}
            </View>
          )}
        </View>
      ) : null}

      <ModalSheet visible={showPicker} onClose={() => setShowPicker(false)} title={equipeLocked ? 'Equipes vinculadas à medição' : 'Selecionar equipe'}>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerDescription}>
            {equipeLocked
              ? 'Escolha entre as equipes autorizadas para este serviço.'
              : `${pickerEquipes.length} ${pickerEquipes.length === 1 ? 'equipe disponível' : 'equipes disponíveis'} nesta obra.`}
          </Text>
          <View style={styles.searchField}>
            <Search size={18} color={Colors.textSecondary} />
            <TextInput
              accessibilityLabel="Buscar equipe"
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar equipe"
              placeholderTextColor={Colors.textTertiary}
              style={styles.searchInput}
            />
            {search ? <IconButton label="Limpar busca" Icon={X} onPress={() => setSearch('')} /> : null}
          </View>
          {hasTypes ? (
            <View style={styles.filterRow}>
              <TeamFilter label={`Todas (${pickerEquipes.length})`} selected={filter === 'all'} onPress={() => setFilter('all')} />
              <TeamFilter label={`Próprias (${pickerEquipes.filter(team => team.tipo === 'proprio').length})`} selected={filter === 'proprio'} onPress={() => setFilter('proprio')} />
              <TeamFilter label={`Terceirizadas (${pickerEquipes.filter(team => team.tipo === 'terceirizado').length})`} selected={filter === 'terceirizado'} onPress={() => setFilter('terceirizado')} />
            </View>
          ) : null}
          <ScrollView style={styles.teamList} contentContainerStyle={styles.teamListContent} keyboardShouldPersistTaps="handled">
            {selectedVisible ? <TeamSection title="Equipe selecionada"><TeamOption team={selectedVisible} selected onPress={() => chooseTeam(selectedVisible.id)} /></TeamSection> : null}
            {ownTeams.length ? <TeamSection title="Equipes próprias">{ownTeams.map(team => <TeamOption key={team.id} team={team} onPress={() => chooseTeam(team.id)} />)}</TeamSection> : null}
            {contractorTeams.length ? <TeamSection title="Equipes terceirizadas">{contractorTeams.map(team => <TeamOption key={team.id} team={team} onPress={() => chooseTeam(team.id)} />)}</TeamSection> : null}
            {untypedTeams.length ? <TeamSection title="Equipes disponíveis">{untypedTeams.map(team => <TeamOption key={team.id} team={team} onPress={() => chooseTeam(team.id)} />)}</TeamSection> : null}
            {!filteredEquipes.length ? (
              <View style={styles.emptyState}>
                <UsersRound size={22} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>Nenhuma equipe encontrada</Text>
                <Text style={styles.emptyText}>Ajuste a busca ou o filtro para ver outras equipes.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </ModalSheet>
    </View>
  );
}

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return day && month ? `${day}/${month}` : iso;
}

function TeamFilter({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.filter, selected && styles.filterSelected, pressed && styles.filterPressed]}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function TeamSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.teamSection}><Text style={styles.teamSectionTitle}>{title}</Text><View style={styles.teamOptions}>{children}</View></View>;
}

function TeamOption({ team, selected = false, onPress }: { team: EquipeRow; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Selecionar equipe ${team.nome}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.teamOption, selected && styles.teamOptionSelected, pressed && styles.teamOptionPressed]}
    >
      <View style={[styles.teamAvatar, selected && styles.teamAvatarSelected]}><Text style={styles.teamAvatarText}>{getInitials(team.nome)}</Text></View>
      <View style={styles.teamOptionBody}><Text numberOfLines={1} style={styles.teamOptionName}>{team.nome}</Text><Text style={styles.teamOptionType}>{formatTeamType(team.tipo)}</Text></View>
      {selected ? <Check size={19} color={Colors.ok} strokeWidth={2.4} /> : <ChevronRight size={18} color={Colors.textTertiary} />}
    </Pressable>
  );
}

function formatTeamType(tipo: string): string {
  if (tipo === 'proprio') return 'Equipe própria';
  if (tipo === 'terceirizado') return 'Equipe terceirizada';
  return 'Equipe vinculada à obra';
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
  avatar: {
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
  avatarText: { color: Colors.brand, fontSize: FontSizes.tiny, fontFamily: FontFamily.bold },
  headerBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...Typography.label, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  metaMono: { fontFamily: FontFamily.mono, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  expandedBody: { paddingHorizontal: Spacing.lg, paddingLeft: Spacing.lg + 3, paddingBottom: Spacing.md, gap: Spacing.md },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: Spacing.xs },
  field: { gap: 6 },
  fieldLabel: { ...Typography.label, color: Colors.text },
  teamTrigger: { minHeight: 64, position: 'relative', overflow: 'hidden', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderNormal, backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  teamTriggerSelected: { borderColor: Colors.brandSignature, backgroundColor: Colors.brandLight },
  teamTriggerPending: { borderColor: Colors.brandSignature },
  teamTriggerError: { borderColor: Colors.nok, borderWidth: 1.5 },
  teamTriggerPressed: { backgroundColor: Colors.surface2 },
  teamTriggerDatum: { position: 'absolute', width: 3, backgroundColor: Colors.brandSignature, left: 0, top: Spacing.sm, bottom: Spacing.sm },
  teamTriggerIcon: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  teamTriggerBody: { flex: 1, minWidth: 0, gap: 1 },
  teamTriggerValue: { ...Typography.label, color: Colors.text },
  teamTriggerPlaceholder: { color: Colors.brand },
  teamTriggerMeta: { ...Typography.caption, color: Colors.textSecondary },
  pickerContent: { gap: Spacing.md },
  pickerDescription: { ...Typography.caption, color: Colors.textSecondary },
  searchField: { minHeight: ComponentSize.input, borderWidth: 1, borderColor: Colors.borderNormal, borderRadius: Radius.md, paddingLeft: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchInput: { flex: 1, minWidth: 0, alignSelf: 'stretch', color: Colors.text, fontFamily: FontFamily.regular, fontSize: FontSizes.md },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  filter: { minHeight: 36, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  filterSelected: { borderColor: Colors.brandSignature, backgroundColor: Colors.brandLight },
  filterPressed: { backgroundColor: Colors.surface2 },
  filterText: { ...Typography.caption, color: Colors.textSecondary, fontFamily: FontFamily.medium },
  filterTextSelected: { color: Colors.brand, fontFamily: FontFamily.semibold },
  teamList: { maxHeight: 360 },
  teamListContent: { gap: Spacing.lg },
  teamSection: { gap: Spacing.sm },
  teamSectionTitle: { ...Typography.overline, color: Colors.textSecondary },
  teamOptions: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  teamOption: { minHeight: 64, backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  teamOptionSelected: { backgroundColor: Colors.brandLight },
  teamOptionPressed: { backgroundColor: Colors.surface2 },
  teamAvatar: { width: 32, height: 32, borderRadius: Radius.full, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
  teamAvatarSelected: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.brandSignature },
  teamAvatarText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Colors.brand },
  teamOptionBody: { flex: 1, minWidth: 0, gap: 1 },
  teamOptionName: { ...Typography.label, color: Colors.text },
  teamOptionType: { ...Typography.caption, color: Colors.textSecondary },
  emptyState: { minHeight: 160, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm, backgroundColor: Colors.surface2, borderRadius: Radius.lg },
  emptyTitle: { ...Typography.label, color: Colors.text },
  emptyText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  error: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },
});
