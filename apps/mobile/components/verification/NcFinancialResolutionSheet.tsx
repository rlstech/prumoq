import { CircleAlert, Landmark } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NcFinancialDeclaration, NcMeasurementBlock } from '../../lib/nc-finance';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../../lib/constants';
import { Button, Field, ModalSheet, SegmentedControl } from '../ui';

type FinalSituation = 'sem_impacto' | 'confirmado';

export interface FinancialNcTarget {
  ncId: string;
  descricao: string;
}

const responsibleOptions = [
  { value: 'construtora', label: 'Construtora' },
  { value: 'empreiteiro', label: 'Empreiteiro' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'projetista', label: 'Projetista' },
  { value: 'em_analise', label: 'Em análise' },
] as const;

const categoryOptions = [
  { value: 'mao_obra_retrabalho', label: 'Mão de obra' },
  { value: 'perda_material', label: 'Material' },
  { value: 'equipamento_mobilizacao', label: 'Equipamento' },
  { value: 'atraso', label: 'Atraso' },
  { value: 'glosa_retencao', label: 'Glosa' },
  { value: 'desconto_empreiteiro', label: 'Desconto' },
  { value: 'outro', label: 'Outro' },
] as const;

function initialDeclaration(): NcFinancialDeclaration {
  return {
    situacao: 'sem_impacto',
    bloqueio: 'nao',
    justificativaSemImpacto: '',
    valorConfirmado: '0',
    responsavelFinanceiro: null,
    categoria: null,
    valorBloqueado: '',
  };
}

export function NcFinancialResolutionSheet({
  visible,
  target,
  onClose,
  onResolve,
}: {
  visible: boolean;
  target: FinancialNcTarget | null;
  onClose: () => void;
  onResolve: (target: FinancialNcTarget, declaration: NcFinancialDeclaration & { situacao: FinalSituation }) => Promise<void>;
}) {
  const [form, setForm] = useState<NcFinancialDeclaration>(initialDeclaration);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setForm(initialDeclaration());
    setError(null);
  }, [target?.ncId, visible]);

  const situation = form.situacao as FinalSituation;
  const setSituation = (next: FinalSituation) => {
    setError(null);
    setForm(previous => ({
      ...previous,
      situacao: next,
      valorConfirmado: next === 'sem_impacto' ? '0' : '',
      justificativaSemImpacto: next === 'sem_impacto' ? previous.justificativaSemImpacto : '',
    }));
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await onResolve(target, { ...form, situacao: situation });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir o impacto financeiro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible={visible} onClose={saving ? () => {} : onClose} title="Resolver impacto financeiro" actions={(
      <Button
        label={saving ? 'Salvando decisão…' : 'Confirmar decisão'}
        Icon={Landmark}
        fullWidth
        loading={saving}
        onPress={() => { void submit(); }}
      />
    )}>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <View style={st.notice} accessibilityRole="alert">
          <CircleAlert size={20} color={Colors.warn} />
          <View style={st.noticeCopy}>
            <Text style={st.noticeTitle}>Decisão obrigatória para encerrar a NC</Text>
            <Text style={st.noticeText} numberOfLines={3}>{target?.descricao ?? ''}</Text>
          </View>
        </View>

        <SegmentedControl
          value={situation}
          onChange={setSituation}
          accessibilityLabel="Situação financeira final"
          options={[
            { value: 'sem_impacto', label: 'Sem impacto' },
            { value: 'confirmado', label: 'Impacto confirmado' },
          ]}
        />

        {situation === 'sem_impacto' ? (
          <Field
            label="Justificativa da ausência de impacto"
            value={form.justificativaSemImpacto ?? ''}
            onChangeText={value => setForm(previous => ({ ...previous, justificativaSemImpacto: value }))}
            multiline
            numberOfLines={3}
            placeholder="Explique por que não houve impacto financeiro"
            textAlignVertical="top"
          />
        ) : (
          <>
            <Field
              label="Valor confirmado (R$)"
              value={form.valorConfirmado ?? ''}
              onChangeText={value => setForm(previous => ({ ...previous, valorConfirmado: value }))}
              keyboardType="decimal-pad"
              placeholder="0,00"
            />
            <OptionGroup
              label="Responsável financeiro"
              value={form.responsavelFinanceiro ?? ''}
              options={responsibleOptions}
              onChange={value => setForm(previous => ({ ...previous, responsavelFinanceiro: value as NcFinancialDeclaration['responsavelFinanceiro'] }))}
            />
            <OptionGroup
              label="Categoria"
              value={form.categoria ?? ''}
              options={categoryOptions}
              onChange={value => setForm(previous => ({ ...previous, categoria: value as NcFinancialDeclaration['categoria'] }))}
            />
          </>
        )}

        <SegmentedControl
          value={form.bloqueio}
          onChange={(bloqueio: NcMeasurementBlock) => setForm(previous => ({ ...previous, bloqueio }))}
          accessibilityLabel="Bloqueio de medição"
          options={[
            { value: 'nao', label: 'Sem bloqueio' },
            { value: 'total', label: 'Bloqueio total' },
            { value: 'parcial', label: 'Bloqueio parcial' },
          ]}
        />

        {form.bloqueio === 'parcial' ? (
          <Field
            label="Valor bloqueado (R$)"
            value={form.valorBloqueado ?? ''}
            onChangeText={value => setForm(previous => ({ ...previous, valorBloqueado: value }))}
            keyboardType="decimal-pad"
            placeholder="0,00"
          />
        ) : null}

        {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
      </ScrollView>
    </ModalSheet>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={st.optionGroup}>
      <Text style={st.label}>{label}</Text>
      <View style={st.optionList}>
        {options.map(option => (
          <Button
            key={option.value}
            label={option.label}
            variant={value === option.value ? 'primary' : 'secondary'}
            onPress={() => onChange(option.value)}
            style={st.optionButton}
          />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  content: { gap: Spacing.md, paddingBottom: Spacing.xs },
  notice: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.warnBg },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { ...Typography.label, color: Colors.text, fontFamily: FontFamily.semibold },
  noticeText: { ...Typography.caption, color: Colors.textSecondary },
  optionGroup: { gap: Spacing.xs },
  label: { ...Typography.label, color: Colors.textSecondary },
  optionList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  optionButton: { minWidth: 0, paddingHorizontal: Spacing.sm },
  error: { ...Typography.caption, color: Colors.nok, backgroundColor: Colors.nokBg, padding: Spacing.sm, borderRadius: Radius.sm },
});
