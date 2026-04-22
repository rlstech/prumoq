import { useState } from 'react';
import {
  Alert, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';
import { db } from '../lib/powersync';
import { supabase } from '../lib/supabase';

const green  = Colors.ok;
const orange = Colors.warn;

const MOTIVOS_ANTES_100 = [
  { key: 'escopo_conforme_projeto', label: 'Serviço concluído conforme projeto (% estimada)' },
  { key: 'escopo_alterado',         label: 'Escopo alterado por ordem do cliente' },
  { key: 'responsabilidade_outra',  label: 'Etapa final não é responsabilidade desta equipe' },
  { key: 'decisao_tecnica',         label: 'Serviço encerrado por decisão técnica' },
  { key: 'outro',                   label: 'Outro (descrever abaixo)' },
];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface Props {
  visible: boolean;
  fvsId: string;
  percentualAtual: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function FVSConclusionModal({ visible, fvsId, percentualAtual, onClose, onSuccess }: Props) {
  const abaixo100 = percentualAtual < 100;

  const [motivo, setMotivo]             = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [resultado, setResultado]       = useState<'aprovado' | 'com_ressalva' | ''>('');
  const [observacao, setObservacao]     = useState('');
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});

  function resetForm() {
    setMotivo(''); setJustificativa(''); setResultado(''); setObservacao(''); setErrors({});
  }

  function validate() {
    const e: Record<string, string> = {};
    if (abaixo100 && !motivo)                        e.motivo = 'Selecione o motivo';
    if (abaixo100 && justificativa.length < 20)      e.justificativa = 'Mínimo 20 caracteres';
    if (!resultado)                                  e.resultado = 'Selecione o resultado final';
    if (resultado === 'com_ressalva' && !observacao) e.observacao = 'Descreva a ressalva';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleConfirm() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const { count } = await supabase
        .from('fvs_conclusoes')
        .select('*', { count: 'exact', head: true })
        .eq('fvs_planejada_id', fvsId);
      const numero = (count ?? 0) + 1;

      await db.execute(
        `INSERT INTO fvs_conclusoes (id, fvs_planejada_id, inspetor_id, numero_conclusao, percentual_final, resultado, motivo_antes_100, observacao_final, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), fvsId, user!.id, numero, percentualAtual, resultado, motivo || null, observacao || null, now],
      );

      const novoStatus = resultado === 'aprovado' && !abaixo100 ? 'concluida' : 'concluida_ressalva';
      await db.execute(
        `UPDATE fvs_planejadas SET status = ?, ultima_conclusao_em = ? WHERE id = ?`,
        [novoStatus, now, fvsId],
      );

      resetForm();
      onSuccess();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível concluir o serviço.');
    } finally {
      setLoading(false);
    }
  }

  const headerBg = abaixo100 ? orange : green;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.sheet}>
          {/* Header */}
          <View style={[st.header, { backgroundColor: headerBg }]}>
            <Text style={st.headerIcon}>✓</Text>
            <Text style={st.headerTitle}>Concluir Serviço</Text>
          </View>

          <ScrollView style={st.body} contentContainerStyle={{ gap: Spacing.md }}>

            {/* Aviso percentual < 100 */}
            {abaixo100 && (
              <View style={[st.alertBanner, { backgroundColor: Colors.warnBg, borderColor: orange }]}>
                <Text style={[st.alertText, { color: orange }]}>
                  ⚠ Serviço marcado em {percentualAtual}% — informe o motivo abaixo
                </Text>
              </View>
            )}

            {/* Motivo (condicional) */}
            {abaixo100 && (
              <View style={st.field}>
                <Text style={st.label}>Motivo da conclusão antes de 100% *</Text>
                <View style={st.optionsList}>
                  {MOTIVOS_ANTES_100.map(m => (
                    <Pressable
                      key={m.key}
                      style={[st.option, motivo === m.key && { borderColor: orange, backgroundColor: Colors.warnBg }]}
                      onPress={() => setMotivo(m.key)}
                    >
                      <View style={[st.radio, motivo === m.key && { borderColor: orange }]}>
                        {motivo === m.key && <View style={[st.radioDot, { backgroundColor: orange }]} />}
                      </View>
                      <Text style={[st.optionLabel, motivo === m.key && { color: orange }]}>{m.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {errors.motivo && <Text style={st.error}>{errors.motivo}</Text>}
              </View>
            )}

            {/* Justificativa (condicional) */}
            {abaixo100 && (
              <View style={st.field}>
                <Text style={st.label}>Justificativa detalhada * (mín. 20 caracteres)</Text>
                <TextInput
                  style={[st.textarea, errors.justificativa && st.inputError]}
                  multiline
                  numberOfLines={4}
                  value={justificativa}
                  onChangeText={setJustificativa}
                  placeholder="Explique por que o serviço está sendo concluído antes de 100%..."
                  placeholderTextColor={Colors.textTertiary}
                />
                <Text style={st.charCount}>{justificativa.length} / 20 mín.</Text>
                {errors.justificativa && <Text style={st.error}>{errors.justificativa}</Text>}
              </View>
            )}

            {/* Resultado final */}
            <View style={st.field}>
              <Text style={st.label}>Resultado final *</Text>
              <View style={st.resultRow}>
                <Pressable
                  style={[st.resultCard, resultado === 'aprovado' && { borderColor: green, backgroundColor: Colors.okBg }]}
                  onPress={() => setResultado('aprovado')}
                >
                  <Text style={[st.resultIcon, resultado === 'aprovado' && { color: green }]}>✓</Text>
                  <Text style={[st.resultLabel, resultado === 'aprovado' && { color: green }]}>Aprovado</Text>
                  <Text style={[st.resultSub, resultado === 'aprovado' && { color: green }]}>Sem pendências</Text>
                </Pressable>
                <Pressable
                  style={[st.resultCard, resultado === 'com_ressalva' && { borderColor: orange, backgroundColor: Colors.warnBg }]}
                  onPress={() => setResultado('com_ressalva')}
                >
                  <Text style={[st.resultIcon, resultado === 'com_ressalva' && { color: orange }]}>⚑</Text>
                  <Text style={[st.resultLabel, resultado === 'com_ressalva' && { color: orange }]}>Com ressalvas</Text>
                  <Text style={[st.resultSub, resultado === 'com_ressalva' && { color: orange }]}>Pendências menores</Text>
                </Pressable>
              </View>
              {errors.resultado && <Text style={st.error}>{errors.resultado}</Text>}
            </View>

            {/* Observação final (condicional) */}
            {resultado === 'com_ressalva' && (
              <View style={st.field}>
                <Text style={st.label}>Descreva as ressalvas *</Text>
                <TextInput
                  style={[st.textarea, errors.observacao && st.inputError]}
                  multiline
                  numberOfLines={4}
                  value={observacao}
                  onChangeText={setObservacao}
                  placeholder="Descreva as pendências ou ressalvas encontradas..."
                  placeholderTextColor={Colors.textTertiary}
                />
                {errors.observacao && <Text style={st.error}>{errors.observacao}</Text>}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={st.footer}>
            <Pressable
              style={[st.btn, { backgroundColor: headerBg }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={st.btnText}>{loading ? 'Aguarde...' : '✓ Confirmar conclusão'}</Text>
            </Pressable>
            <Pressable style={[st.btn, st.btnGhost]} onPress={() => { resetForm(); onClose(); }} disabled={loading}>
              <Text style={st.btnGhostText}>Cancelar — continuar verificando</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: Colors.bg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '92%' },
  header:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  headerIcon:  { fontSize: 20, color: '#fff' },
  headerTitle: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  alertBanner: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  alertText:   { fontSize: FontSizes.sm, fontWeight: '500', lineHeight: 20 },
  field:       { gap: Spacing.xs },
  label:       { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  optionsList: { gap: Spacing.xs },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, backgroundColor: Colors.surface,
  },
  radio:    { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.borderNormal, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  optionLabel: { fontSize: FontSizes.sm, color: Colors.text, flex: 1 },
  resultRow: { flexDirection: 'row', gap: Spacing.sm },
  resultCard: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 4, backgroundColor: Colors.surface,
  },
  resultIcon:  { fontSize: 22 },
  resultLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary },
  resultSub:   { fontSize: FontSizes.xs, color: Colors.textTertiary, textAlign: 'center' },
  textarea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: FontSizes.sm, color: Colors.text,
    minHeight: 90, textAlignVertical: 'top', backgroundColor: Colors.surface,
  },
  inputError: { borderColor: Colors.nok },
  charCount:  { fontSize: FontSizes.xs, color: Colors.textTertiary, textAlign: 'right' },
  error:      { fontSize: FontSizes.xs, color: Colors.nok },
  footer: { padding: Spacing.lg, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  btn:          { padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '600', fontSize: FontSizes.sm },
  btnGhost:     { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.text, fontWeight: '500', fontSize: FontSizes.sm },
});
