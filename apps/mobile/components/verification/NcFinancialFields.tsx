import { AlertCircle, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Chip, DataRow, Field, InlineDateField, ListSurface, ModalSheet } from '../ui';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../../lib/constants';
import type { NcFinancialDeclaration, NcFinancialSituation, NcMeasurementBlock } from '../../lib/nc-finance';
import { ManagerRow } from './types';

interface Props {
  financial: NcFinancialDeclaration | null | undefined;
  onChange: (patch: Partial<NcFinancialDeclaration>) => void;
  managers: ManagerRow[];
  error?: string;
}

const SITUATIONS: readonly [NcFinancialSituation, string][] = [
  ['sem_impacto', 'Sem impacto'],
  ['em_avaliacao', 'Em avaliação'],
  ['estimado', 'Estimado'],
  ['confirmado', 'Confirmado'],
];

const BLOCK_OPTIONS: readonly [NcMeasurementBlock, string][] = [
  ['nao', 'Não'],
  ['total', 'Totalmente'],
  ['parcial', 'Parcialmente'],
];

const RESPONSAVEL_FINANCEIRO_OPTIONS = ['construtora', 'empreiteiro', 'fornecedor', 'projetista', 'em_analise'] as const;
const CATEGORIA_OPTIONS = [
  'mao_obra_retrabalho', 'perda_material', 'equipamento_mobilizacao',
  'atraso', 'glosa_retencao', 'desconto_empreiteiro', 'outro',
] as const;

function humanize(value: string): string {
  return value.replaceAll('_', ' ');
}

/** Financial-impact declaration required on an NC when the work has
 * controle_financeiro_nc_efetivo enabled. Extracted from the inline NC panel
 * so the ~10 conditional fields aren't minified into a handful of lines. */
export function NcFinancialFields({ financial, onChange, managers, error }: Props) {
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const situacao = financial?.situacao ?? 'em_avaliacao';
  const bloqueio = financial?.bloqueio ?? 'nao';

  function patch(next: Partial<NcFinancialDeclaration>) {
    onChange({ situacao, bloqueio, ...financial, ...next });
  }

  const selectedManager = managers.find(m => m.id === financial?.responsavelAvaliacaoId);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>IMPACTO FINANCEIRO *</Text>
        <Badge tone="warning" size="sm" label="Obrigatório" Icon={AlertCircle} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.field}>
        <Text style={styles.label}>Situação financeira</Text>
        <View style={styles.optionWrap}>
          {SITUATIONS.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={situacao === value}
              onPress={() => patch({ situacao: value, valorConfirmado: value === 'sem_impacto' ? '0' : financial?.valorConfirmado })}
            />
          ))}
        </View>
      </View>

      {situacao === 'sem_impacto' ? (
        <Field
          label="Justificativa *"
          value={financial?.justificativaSemImpacto ?? ''}
          onChangeText={value => patch({ justificativaSemImpacto: value, valorConfirmado: '0' })}
          placeholder="Por que não existe impacto?"
        />
      ) : null}

      {situacao === 'em_avaliacao' ? (
        <>
          <View style={styles.field}>
            <DataRow
              label="Responsável pela avaliação *"
              value={selectedManager?.nome ?? 'Selecionar gestor'}
              onPress={() => setShowManagerPicker(true)}
              accessibilityLabel="Selecionar responsável pela avaliação"
              trailing={<ChevronDown size={16} color={Colors.textSecondary} />}
              last
              style={styles.pickerRow}
            />
          </View>
          <InlineDateField
            label="Prazo para definição *"
            value={financial?.prazoAvaliacao ?? ''}
            onChange={value => patch({ prazoAvaliacao: value })}
          />
          <ModalSheet
            visible={showManagerPicker}
            onClose={() => setShowManagerPicker(false)}
            title="Responsável pela avaliação"
          >
            <ListSurface>
              {managers.map((manager, index) => (
                <DataRow
                  key={manager.id}
                  label={manager.nome}
                  onPress={() => { patch({ responsavelAvaliacaoId: manager.id }); setShowManagerPicker(false); }}
                  accessibilityLabel={`Selecionar ${manager.nome}`}
                  last={index === managers.length - 1}
                />
              ))}
            </ListSurface>
          </ModalSheet>
        </>
      ) : null}

      {(situacao === 'estimado' || situacao === 'confirmado') && financial ? (
        <>
          <Field
            label={situacao === 'estimado' ? 'Valor estimado *' : 'Valor confirmado *'}
            keyboardType="decimal-pad"
            placeholder="0,00"
            value={(situacao === 'estimado' ? financial.valorEstimado : financial.valorConfirmado) ?? ''}
            onChangeText={value => patch(situacao === 'estimado' ? { valorEstimado: value } : { valorConfirmado: value })}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Responsável financeiro *</Text>
            <View style={styles.optionWrap}>
              {RESPONSAVEL_FINANCEIRO_OPTIONS.map(value => (
                <Chip
                  key={value}
                  label={humanize(value)}
                  selected={financial.responsavelFinanceiro === value}
                  onPress={() => patch({ responsavelFinanceiro: value })}
                />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Categoria *</Text>
            <View style={styles.optionWrap}>
              {CATEGORIA_OPTIONS.map(value => (
                <Chip
                  key={value}
                  label={humanize(value)}
                  selected={financial.categoria === value}
                  onPress={() => patch({ categoria: value })}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Esta NC bloqueia a medição?</Text>
        <View style={styles.optionWrap}>
          {BLOCK_OPTIONS.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={bloqueio === value}
              onPress={() => patch({ bloqueio: value })}
            />
          ))}
        </View>
      </View>

      {bloqueio === 'parcial' ? (
        <View style={styles.field}>
          <Field
            label="Valor bloqueado *"
            keyboardType="decimal-pad"
            placeholder="0,00"
            value={financial?.valorBloqueado ?? ''}
            onChangeText={value => patch({ valorBloqueado: value })}
          />
          <Text style={styles.hint}>
            Descontado da medição quando o responsável financeiro é o empreiteiro executor do serviço.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Not a card: this sits inside the NC sheet, which is already a surface of
  // its own, so a nested one would just box a box. A hairline opens the section.
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { ...Typography.overline, color: Colors.warn },
  error: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },
  field: { gap: 6 },
  label: { ...Typography.label, color: Colors.text },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerRow: { backgroundColor: Colors.surface2, borderRadius: Radius.sm },
  hint: { ...Typography.caption, color: Colors.textSecondary },
});
