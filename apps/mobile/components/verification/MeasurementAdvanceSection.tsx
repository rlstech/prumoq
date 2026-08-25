import { StyleSheet, Text, View } from 'react-native';
import { DatumCard, ErrorBanner, Field, SegmentedControl } from '../ui';
import { Colors, FontFamily, Spacing, Typography } from '../../lib/constants';
import type { MeasurementAdvanceDraft } from '../../lib/verification/draft.types';
import { MeasurementLinkRow, measurementTotal } from './types';

interface Props {
  enabled: boolean;
  /** Measurement links already filtered to the currently selected team. */
  links: MeasurementLinkRow[];
  values: Record<string, MeasurementAdvanceDraft>;
  onChange: (linkId: string, field: 'executadoDelta' | 'aprovadoDelta', value: string) => void;
  registrarAvanco: boolean;
  onRegistrarAvancoChange: (registrar: boolean) => void;
  fallbackName?: string;
}

/** Optional physical-advance capture, shown only when the work has active
 * measurement tracking. Kept last in the closing step — it's opt-in and
 * never blocks saving the verification itself. */
export function MeasurementAdvanceSection({
  enabled,
  links,
  values,
  onChange,
  registrarAvanco,
  onRegistrarAvancoChange,
  fallbackName,
}: Props) {
  if (!enabled) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.overline}>AVANÇO FÍSICO · OPCIONAL</Text>
      <Text style={styles.helper}>
        Informe apenas o que foi executado e aprovado nesta verificação — o sistema soma ao acumulado.
      </Text>
      <SegmentedControl
        accessibilityLabel="Registrar avanço físico nesta verificação"
        value={registrarAvanco ? 'registrar' : 'sem_avanco'}
        onChange={value => onRegistrarAvancoChange(value === 'registrar')}
        options={[
          { value: 'sem_avanco', label: 'Sem avanço' },
          { value: 'registrar', label: 'Registrar avanço' },
        ]}
      />
      {registrarAvanco ? (
        links.length === 0 ? (
          <ErrorBanner message="A equipe selecionada não é a responsável ativa por este serviço. Nenhum avanço poderá ser atribuído a ela." />
        ) : (
          links.map(link => {
            const draft = values[link.id];
            return (
              <DatumCard key={link.id} tone="info" style={styles.linkCard}>
                <Text style={styles.linkTitle}>{link.etapa_nome ?? fallbackName ?? 'Serviço'}</Text>
                <Text style={styles.linkMeta}>
                  Empreiteiro: {link.equipe_nome} · escopo {link.escopo_atribuido} {link.unidade}
                </Text>
                <Text style={styles.linkMeta}>
                  Acumulado anterior: executado {link.executado_atual} {link.unidade} · aprovado {link.aprovado_atual} {link.unidade}
                </Text>
                <View style={styles.twoCol}>
                  <View style={styles.col}>
                    <Field
                      label="Executado nesta verificação"
                      keyboardType="decimal-pad"
                      placeholder="0"
                      value={draft?.executadoDelta ?? ''}
                      onChangeText={value => onChange(link.id, 'executadoDelta', value)}
                    />
                  </View>
                  <View style={styles.col}>
                    <Field
                      label="Aprovado nesta verificação"
                      keyboardType="decimal-pad"
                      placeholder="0"
                      value={draft?.aprovadoDelta ?? ''}
                      onChangeText={value => onChange(link.id, 'aprovadoDelta', value)}
                    />
                  </View>
                </View>
                <Text style={styles.linkTotal}>
                  Novo acumulado: executado {measurementTotal(link.executado_atual, draft?.executadoDelta ?? '')} · aprovado {measurementTotal(link.aprovado_atual, draft?.aprovadoDelta ?? '')} {link.unidade}
                </Text>
              </DatumCard>
            );
          })
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  helper: { ...Typography.caption, color: Colors.textSecondary },
  linkCard: { gap: Spacing.sm },
  linkTitle: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  linkMeta: { ...Typography.caption, color: Colors.textSecondary },
  linkTotal: { ...Typography.caption, fontFamily: FontFamily.mono, color: Colors.text },
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  col: { flex: 1 },
});
