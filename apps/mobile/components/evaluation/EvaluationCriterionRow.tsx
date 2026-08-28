import { CheckCircle2, XCircle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { ChoiceToggle, ChoiceToggleOption, Field } from '../ui';
import { Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../lib/constants';
import { EvaluationCriterion, EvaluationResult } from './types';

/** Width of the ordinal gutter — title and the answer control hang off the
 * same vertical axis as the FVS checklist row, so the two capture screens read
 * as the same instrument. */
const GUTTER = 26;

const answerOptions: readonly ChoiceToggleOption<EvaluationResult>[] = [
  { value: 'atende', label: 'Atende', tone: 'success', Icon: CheckCircle2 },
  { value: 'nao_atende', label: 'Não atende', tone: 'danger', Icon: XCircle },
];

interface Props {
  criterion: EvaluationCriterion;
  result?: EvaluationResult;
  onResultChange: (result: EvaluationResult) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  resultError?: string;
  commentError?: string;
  /** The next unanswered criterion — marked in Cal Viva so the inspector always
   * knows where the list left off. */
  isNext?: boolean;
  last?: boolean;
}

/** One criterion: ordinal + title + weight, the Atende/Não atende control, and
 * the justification that opens in place when the criterion is not met. */
export function EvaluationCriterionRow({
  criterion,
  result,
  onResultChange,
  comment,
  onCommentChange,
  resultError,
  commentError,
  isNext = false,
  last = false,
}: Props) {
  const semanticColor = result === 'atende' ? Colors.ok : result === 'nao_atende' ? Colors.nok : null;
  const answered = !!semanticColor;
  // An answered row already carries a semantic colour, and design-system.md
  // gives that priority over the Cal Viva "you are here" marker.
  const showNext = isNext && !answered;
  const datumColor = semanticColor ?? (showNext ? Colors.brandSignature : Colors.border);
  const ordinalColor = semanticColor ?? (showNext ? Colors.brand : Colors.textTertiary);

  return (
    <View style={[styles.row, !last && styles.rowBordered]}>
      <View
        style={[
          styles.datum,
          answered ? styles.datumAnswered : styles.datumPending,
          { backgroundColor: datumColor },
        ]}
      />

      <View style={styles.titleRow}>
        <View style={[styles.gutter, showNext && styles.gutterNext]}>
          <Text style={[styles.ordinal, { color: ordinalColor }]}>
            {String(criterion.ordem).padStart(2, '0')}
          </Text>
        </View>
        <Text style={styles.title}>{criterion.titulo}</Text>
        <Text style={[styles.weight, answered && { color: semanticColor ?? Colors.brand }]}>
          {criterion.peso} pts
        </Text>
      </View>

      <View style={styles.indent}>
        <ChoiceToggle
          value={result}
          options={answerOptions}
          onChange={onResultChange}
          error={resultError}
          accessibilityLabel={`Resultado do critério ${criterion.ordem}: ${criterion.titulo}`}
        />

        {result === 'nao_atende' ? (
          <Field
            label="Por que não atende? *"
            value={comment}
            onChangeText={onCommentChange}
            placeholder="Descreva o que foi observado em campo"
            multiline
            error={commentError}
            hint={commentError ? undefined : 'Fica registrado na avaliação assinada.'}
            accessibilityLabel={`Justificativa do critério ${criterion.ordem}`}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingLeft: Spacing.lg + 3,
    gap: Spacing.sm,
  },
  rowBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  datum: { position: 'absolute', left: 0, width: 3 },
  datumPending: {
    top: Spacing.md,
    bottom: Spacing.md,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  datumAnswered: { top: 0, bottom: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  gutter: {
    width: GUTTER,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  gutterNext: { backgroundColor: Colors.actionSoft },
  ordinal: { fontFamily: FontFamily.monoSemibold, fontSize: FontSizes.xs, lineHeight: 18 },
  title: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.text,
    fontFamily: FontFamily.semibold,
    marginTop: 1,
  },
  weight: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.tiny,
    lineHeight: 20,
    color: Colors.textTertiary,
  },
  indent: { paddingLeft: GUTTER + Spacing.sm, gap: Spacing.sm },
});
