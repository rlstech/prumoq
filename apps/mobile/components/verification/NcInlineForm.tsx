import { AlertCircle, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, DataRow, Field, InlineDateField, ListSurface, ModalSheet, PhotoSlot } from '../ui';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../../lib/constants';
import type { NcFinancialDeclaration } from '../../lib/nc-finance';
import { EquipeRow, ManagerRow, NcDetail, NcFieldErrors, stripPendingPrefix } from './types';
import { NcFinancialFields } from './NcFinancialFields';

interface Props {
  detail: NcDetail;
  onChange: (patch: Partial<NcDetail>) => void;
  onAddPhoto: () => void;
  equipes: EquipeRow[];
  errors: NcFieldErrors;
  financialRequired: boolean;
  managers: ManagerRow[];
}

/**
 * Inline NC registration form (RN-01: 4 required fields + photo). Rendered
 * in place inside ChecklistItemRow when the user marks an item não conforme.
 * Deliberately not a card: the row's own red datum already scopes it, so a
 * nested surface would only draw a box inside a box and repeat that line.
 * A hairline rule opens the section and the red state is carried by the
 * overline and the badge.
 */
export function NcInlineForm({ detail, onChange, onAddPhoto, equipes, errors, financialRequired, managers }: Props) {
  const [showRespPicker, setShowRespPicker] = useState(false);
  const selectedResp = equipes.find(e => e.id === detail.responsavel_id);
  const photoUri = detail.foto ? stripPendingPrefix(detail.foto) : null;

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
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>REGISTRO DE NÃO CONFORMIDADE</Text>
        <Badge tone="danger" size="sm" label="Obrigatório" Icon={AlertCircle} />
      </View>

      <Field
        label="Descrição da não conformidade *"
        multiline
        numberOfLines={2}
        placeholder="Descreva o problema encontrado…"
        value={detail.descricao}
        onChangeText={value => onChange({ descricao: value })}
        error={errors.descricao}
      />

      <PhotoSlot
        uri={photoUri}
        onPress={onAddPhoto}
        onRemove={() => onChange({ foto: null })}
        label="Foto da evidência"
        height={120}
        required
        error={errors.foto}
        pending={!!detail.foto?.startsWith('pending:')}
        accessibilityLabel="Adicionar foto da evidência"
      />

      <Field
        label="Solução proposta *"
        multiline
        numberOfLines={2}
        placeholder="Descreva a ação corretiva…"
        value={detail.solucao_proposta}
        onChangeText={value => onChange({ solucao_proposta: value })}
        error={errors.solucao}
      />

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <InlineDateField
            label="Nova data de verif. *"
            value={detail.data_nova_verif}
            onChange={value => onChange({ data_nova_verif: value })}
            error={errors.data}
          />
        </View>
        <View style={styles.col}>
          <View style={styles.field}>
            <Text style={styles.label}>Responsável *</Text>
            <DataRow
              label="Equipe"
              value={selectedResp ? selectedResp.nome : 'Selecionar…'}
              onPress={() => setShowRespPicker(true)}
              accessibilityLabel="Selecionar responsável pela correção"
              trailing={<ChevronDown size={16} color={Colors.textSecondary} />}
              last
              style={styles.pickerRow}
            />
            {errors.responsavel ? <Text style={styles.error}>{errors.responsavel}</Text> : null}
          </View>
        </View>
      </View>

      {/* Last, not first: the financial declaration is its own titled section
          now, so it has to follow the NC's own required fields instead of
          splitting the header from the fields it introduces. */}
      {financialRequired ? (
        <NcFinancialFields
          financial={detail.financeiro}
          onChange={patchFinancial}
          managers={managers}
          error={errors.financeiro}
        />
      ) : null}

      <ModalSheet
        visible={showRespPicker}
        onClose={() => setShowRespPicker(false)}
        title="Responsável pela correção"
      >
        <ListSurface>
          {equipes.map((eq, index) => (
            <DataRow
              key={eq.id}
              label={eq.nome}
              onPress={() => { onChange({ responsavel_id: eq.id }); setShowRespPicker(false); }}
              accessibilityLabel={`Selecionar ${eq.nome}`}
              last={index === equipes.length - 1}
            />
          ))}
        </ListSurface>
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { ...Typography.overline, color: Colors.nok },
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  col: { flex: 1 },
  field: { gap: 6 },
  label: { ...Typography.label, color: Colors.text },
  pickerRow: { backgroundColor: Colors.surface2, borderRadius: Radius.sm },
  error: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },
});
