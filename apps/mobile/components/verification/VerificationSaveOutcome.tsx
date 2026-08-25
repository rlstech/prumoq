import { Check, LockKeyhole, Save } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Colors,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '../../lib/constants';

export type SaveOutcome = 'continue' | 'conclude';

const options: readonly {
  value: SaveOutcome;
  title: string;
  description: string;
  accessibilityHint: string;
  Icon: typeof Save;
}[] = [
  {
    value: 'continue',
    title: 'Continuar acompanhamento',
    description: 'Salva esta verificação e mantém a FVS aberta.',
    accessibilityHint: 'Permite registrar novas verificações nesta FVS.',
    Icon: Save,
  },
  {
    value: 'conclude',
    title: 'Concluir FVS',
    description: 'Salva esta verificação e bloqueia novas verificações.',
    accessibilityHint: 'Uma nova verificação exigirá a reabertura da FVS com justificativa.',
    Icon: LockKeyhole,
  },
] as const;

function OutcomeOption({
  value,
  selected,
  title,
  description,
  accessibilityHint,
  Icon,
  disabled,
  onSelect,
}: (typeof options)[number] & {
  selected: boolean;
  disabled: boolean;
  onSelect: (value: SaveOutcome) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => onSelect(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        focused && styles.optionFocused,
        pressed && !disabled && styles.optionPressed,
        disabled && styles.optionDisabled,
      ]}
    >
      {selected ? <View style={styles.selectionDatum} /> : null}
      <View style={[styles.iconSurface, selected && styles.iconSurfaceSelected]}>
        <Icon size={20} color={selected ? Colors.brand : Colors.textSecondary} strokeWidth={2.2} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Check size={14} color={Colors.text} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export function VerificationSaveOutcome({
  value,
  onChange,
  disabled = false,
}: {
  value: SaveOutcome;
  onChange: (value: SaveOutcome) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.headingGroup}>
        <Text style={styles.heading}>Após salvar, o que deseja fazer?</Text>
        <Text style={styles.support}>Escolha se esta FVS continua em acompanhamento ou se o serviço está encerrado.</Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Ação após salvar a verificação"
        style={styles.options}
      >
        {options.map(option => (
          <OutcomeOption
            key={option.value}
            {...option}
            selected={value === option.value}
            disabled={disabled}
            onSelect={onChange}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  headingGroup: {
    gap: Spacing.xs,
  },
  heading: {
    ...Typography.bodyMedium,
    color: Colors.text,
    fontFamily: FontFamily.semibold,
  },
  support: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  options: {
    gap: Spacing.sm,
  },
  option: {
    position: 'relative',
    minHeight: 80,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    overflow: 'hidden',
  },
  optionSelected: {
    borderColor: Colors.brand,
  },
  optionFocused: {
    borderColor: Colors.brand,
    borderWidth: 2,
  },
  optionPressed: {
    backgroundColor: Colors.surface2,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  selectionDatum: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: Colors.brandSignature,
  },
  iconSurface: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSurfaceSelected: {
    backgroundColor: Colors.brandLight,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionTitle: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  optionTitleSelected: {
    color: Colors.brand,
    fontFamily: FontFamily.semibold,
  },
  optionDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.brandSignature,
    backgroundColor: Colors.brandSignature,
  },
});
