import { AlertCircle, Images } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Chip, Field, InlineDateField, ModalSheet, PhotoSlot } from '../ui';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../../lib/constants';
import type { NcFinancialDeclaration } from '../../lib/nc-finance';
import { EquipeRow, ItemRow, ManagerRow, NcDetail, NcFieldErrors, stripPendingPrefix } from './types';
import { NcFinancialFields } from './NcFinancialFields';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Null while the sheet is closing — the item it belonged to may already be
   * gone from state, and the header would otherwise read as an empty row. */
  item: ItemRow | null;
  detail: NcDetail;
  onChange: (patch: Partial<NcDetail>) => void;
  onAddPhoto: () => void;
  onPickPhoto: () => void;
  /** Drops the não conforme answer and closes: the only way back out of a NC
   * that was opened by mistake, since the collapsed row routes taps here. */
  onClearResult: () => void;
  equipes: EquipeRow[];
  errors: NcFieldErrors;
  financialRequired: boolean;
  managers: ManagerRow[];
}

/** Relative deadlines, because nobody counts calendar days on a slab. */
const DEADLINES = [
  { days: 2, label: 'Em 2 dias' },
  { days: 7, label: 'Em 1 semana' },
  { days: 15, label: 'Em 15 dias' },
] as const;

function isoInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * NC registration (RN-01) as a sheet over the checklist rather than a form
 * expanded inside the row. Inline, it pushed every following item down the page
 * and the inspector lost their place in a thirty-item list; here the list stays
 * exactly where it was.
 *
 * Field order follows what actually happens on site: the photo is taken while
 * standing at the defect, before there is anything to write about it. The
 * deadline and the responsible team are chips instead of a nested ModalSheet —
 * a modal inside a form inside a list row was three surfaces deep.
 */
export function NcSheet({
  visible,
  onClose,
  item,
  detail,
  onChange,
  onAddPhoto,
  onPickPhoto,
  onClearResult,
  equipes,
  errors,
  financialRequired,
  managers,
}: Props) {
  const photoUri = detail.foto ? stripPendingPrefix(detail.foto) : null;
  const deadlines = useMemo(
    () => DEADLINES.map(option => ({ ...option, iso: isoInDays(option.days) })),
    [],
  );
  const customDate = !!detail.data_nova_verif
    && !deadlines.some(option => option.iso === detail.data_nova_verif);

  const filled = [
    !!detail.foto,
    !!detail.descricao.trim(),
    !!detail.solucao_proposta.trim(),
    !!detail.data_nova_verif,
    !!detail.responsavel_id,
  ].filter(Boolean).length;
  const complete = filled === 5;

  function patchFinancial(patch: Partial<NcFinancialDeclaration>) {
    onChange({
      financeiro: {
        situacao: detail.financeiro?.situacao ?? 'em_avaliacao',
        bloqueio: detail.financeiro?.bloqueio ?? 'nao',
        ...detail.financeiro,
        ...patch,
      },
    });
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Não conformidade"
      actions={
        <>
          <Button label="Alterar resposta" variant="secondary" onPress={onClearResult} />
          <Button
            label={complete ? 'Concluir' : `Faltam ${5 - filled}`}
            onPress={onClose}
            disabled={!complete}
            style={styles.primaryAction}
          />
        </>
      }
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {item ? (
          <View style={styles.banner}>
            <View style={styles.bannerDatum} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerOrdinal}>{String(item.ordem).padStart(2, '0')}</Text>
              <Text style={styles.bannerTitle}>{item.titulo}</Text>
            </View>
            <Badge
              tone={complete ? 'success' : 'warning'}
              size="sm"
              label={`${filled}/5`}
              Icon={complete ? undefined : AlertCircle}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <PhotoSlot
            uri={photoUri}
            onPress={onAddPhoto}
            onRemove={() => onChange({ foto: null })}
            label="Foto da evidência"
            height={140}
            required
            error={errors.foto}
            pending={!!detail.foto?.startsWith('pending:')}
            accessibilityLabel="Fotografar a evidência"
          />
          {!photoUri ? (
            <Button
              label="Escolher da galeria"
              variant="ghost"
              Icon={Images}
              onPress={onPickPhoto}
              accessibilityHint="Usa uma foto já existente no aparelho"
            />
          ) : null}
        </View>

        <Field
          label="O que está errado *"
          multiline
          numberOfLines={3}
          placeholder="Descreva o problema encontrado…"
          value={detail.descricao}
          onChangeText={value => onChange({ descricao: value })}
          error={errors.descricao}
        />

        <Field
          label="Solução proposta *"
          multiline
          numberOfLines={3}
          placeholder="Descreva a ação corretiva…"
          value={detail.solucao_proposta}
          onChangeText={value => onChange({ solucao_proposta: value })}
          error={errors.solucao}
        />

        <View style={styles.section}>
          <Text style={styles.label}>Nova verificação em *</Text>
          <View style={styles.chips}>
            {deadlines.map(option => (
              <Chip
                key={option.days}
                label={option.label}
                selected={detail.data_nova_verif === option.iso}
                onPress={() => onChange({ data_nova_verif: option.iso })}
              />
            ))}
            <Chip
              label="Escolher data"
              selected={customDate}
              onPress={() => onChange({ data_nova_verif: isoInDays(30) })}
            />
          </View>
          {customDate ? (
            <InlineDateField
              label="Data da nova verificação"
              value={detail.data_nova_verif}
              onChange={value => onChange({ data_nova_verif: value })}
              min={isoInDays(1)}
              error={errors.data}
            />
          ) : errors.data ? (
            <Text style={styles.error}>{errors.data}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Responsável pela correção *</Text>
          <View style={styles.chips}>
            {equipes.map(equipe => (
              <Chip
                key={equipe.id}
                label={equipe.nome}
                selected={detail.responsavel_id === equipe.id}
                onPress={() => onChange({ responsavel_id: equipe.id })}
              />
            ))}
          </View>
          {errors.responsavel ? <Text style={styles.error}>{errors.responsavel}</Text> : null}
        </View>

        {financialRequired ? (
          <NcFinancialFields
            financial={detail.financeiro}
            onChange={patchFinancial}
            managers={managers}
            error={errors.financeiro}
          />
        ) : null}
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 520 },
  content: { gap: Spacing.lg, paddingBottom: Spacing.xs },
  banner: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.md,
    overflow: 'hidden',
    paddingVertical: Spacing.md,
    paddingRight: Spacing.md,
    paddingLeft: Spacing.md + 3,
  },
  bannerDatum: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.nok },
  bannerBody: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  bannerOrdinal: { fontFamily: FontFamily.monoSemibold, fontSize: 13, lineHeight: 18, color: Colors.nok },
  bannerTitle: { flex: 1, ...Typography.label, color: Colors.nok },
  section: { gap: Spacing.sm },
  label: { ...Typography.label, color: Colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  error: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },
  primaryAction: { flex: 1 },
});
