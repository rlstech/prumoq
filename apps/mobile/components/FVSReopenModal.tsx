import { useQuery } from '@powersync/react-native';
import { useEffect, useState } from 'react';
import {
  Alert, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';
import { db } from '../lib/powersync';
import { supabase } from '../lib/supabase';

const purple   = '#6A1B9A';
const purpleBg = '#F3E5F5';

const MOTIVOS = [
  { key: 'reclamacao_cliente',     label: 'Reclamação de cliente / vistoria' },
  { key: 'auditoria_interna',      label: 'Auditoria interna de qualidade' },
  { key: 'servico_complementar',   label: 'Serviço complementar identificado' },
  { key: 'correcao_registro',      label: 'Correção de registro incorreto' },
  { key: 'determinacao_engenharia', label: 'Determinação da engenharia' },
  { key: 'outro',                  label: 'Outro' },
];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface AutorizadorRow { id: string; nome: string; perfil: string }

interface Props {
  visible: boolean;
  fvsId: string;
  obraId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function FVSReopenModal({ visible, fvsId, obraId, onClose, onSuccess }: Props) {
  const [motivo, setMotivo]               = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [autorizadoPor, setAutorizadoPor] = useState('');
  const [loading, setLoading]             = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});

  const { data: autorizadores } = useQuery<AutorizadorRow>(`
    SELECT u.id, u.nome, u.perfil
    FROM usuarios u
    JOIN obra_usuarios ou ON ou.usuario_id = u.id
    WHERE ou.obra_id = ?
    AND u.perfil IN ('gestor', 'admin')
    AND ou.ativo = true
  `, [obraId]);

  useEffect(() => {
    if (visible) {
      setMotivo(''); setJustificativa(''); setAutorizadoPor(''); setErrors({});
    }
  }, [visible]);

  function validate() {
    const e: Record<string, string> = {};
    if (!motivo)                        e.motivo = 'Selecione o motivo';
    if (justificativa.length < 20)      e.justificativa = 'Mínimo 20 caracteres';
    if (!autorizadoPor)                 e.autorizadoPor = 'Selecione o autorizador';
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
        .from('fvs_reaberturas')
        .select('*', { count: 'exact', head: true })
        .eq('fvs_planejada_id', fvsId);
      const numero = (count ?? 0) + 1;

      await db.execute(
        `INSERT INTO fvs_reaberturas (id, fvs_planejada_id, solicitado_por, autorizado_por, motivo_tipo, justificativa, numero_reabertura, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), fvsId, user!.id, autorizadoPor, motivo, justificativa, numero, now],
      );
      await db.execute(
        `UPDATE fvs_planejadas SET status = ?, ultima_reabertura_em = ? WHERE id = ?`,
        ['em_revisao', now, fvsId],
      );

      onSuccess();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível reabrir o serviço.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.sheet}>
          {/* Header */}
          <View style={[st.header, { backgroundColor: purple }]}>
            <Text style={st.headerIcon}>↑</Text>
            <Text style={st.headerTitle}>Reabrir Serviço</Text>
          </View>

          <ScrollView style={st.body} contentContainerStyle={{ gap: Spacing.md }}>
            {/* Info banner */}
            <View style={[st.infoBanner, { backgroundColor: Colors.progressBg, borderColor: Colors.progress }]}>
              <Text style={[st.infoText, { color: Colors.progress }]}>
                ℹ Esta ação será registrada no histórico com data, hora e responsável. O gestor da obra será notificado.
              </Text>
            </View>

            {/* Motivo */}
            <View style={st.field}>
              <Text style={st.label}>Motivo da reabertura *</Text>
              <View style={st.optionsList}>
                {MOTIVOS.map(m => (
                  <Pressable
                    key={m.key}
                    style={[st.option, motivo === m.key && { borderColor: purple, backgroundColor: purpleBg }]}
                    onPress={() => setMotivo(m.key)}
                  >
                    <View style={[st.radio, motivo === m.key && { borderColor: purple }]}>
                      {motivo === m.key && <View style={[st.radioDot, { backgroundColor: purple }]} />}
                    </View>
                    <Text style={[st.optionLabel, motivo === m.key && { color: purple }]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.motivo && <Text style={st.error}>{errors.motivo}</Text>}
            </View>

            {/* Justificativa */}
            <View style={st.field}>
              <Text style={st.label}>Justificativa detalhada * (mín. 20 caracteres)</Text>
              <TextInput
                style={[st.textarea, errors.justificativa && st.inputError]}
                multiline
                numberOfLines={4}
                value={justificativa}
                onChangeText={setJustificativa}
                placeholder="Descreva por que este serviço precisa ser reaberto..."
                placeholderTextColor={Colors.textTertiary}
              />
              <Text style={st.charCount}>{justificativa.length} / 20 mín.</Text>
              {errors.justificativa && <Text style={st.error}>{errors.justificativa}</Text>}
            </View>

            {/* Autorizado por */}
            <View style={st.field}>
              <Text style={st.label}>Autorizado por *</Text>
              {autorizadores.length === 0 ? (
                <Text style={st.emptyMsg}>Nenhum gestor/admin encontrado para esta obra.</Text>
              ) : (
                <View style={st.optionsList}>
                  {autorizadores.map(a => (
                    <Pressable
                      key={a.id}
                      style={[st.option, autorizadoPor === a.id && { borderColor: purple, backgroundColor: purpleBg }]}
                      onPress={() => setAutorizadoPor(a.id)}
                    >
                      <View style={[st.radio, autorizadoPor === a.id && { borderColor: purple }]}>
                        {autorizadoPor === a.id && <View style={[st.radioDot, { backgroundColor: purple }]} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.optionLabel, autorizadoPor === a.id && { color: purple }]}>{a.nome}</Text>
                        <Text style={st.optionSub}>{a.perfil}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              {errors.autorizadoPor && <Text style={st.error}>{errors.autorizadoPor}</Text>}
            </View>

            {/* Info bottom */}
            <View style={[st.infoBanner, { backgroundColor: Colors.okBg, borderColor: Colors.ok }]}>
              <Text style={[st.infoText, { color: Colors.ok }]}>
                ℹ Após reabrir, o status muda para Em revisão. Uma nova verificação pode ser registrada. O histórico completo é preservado.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={st.footer}>
            <Pressable
              style={[st.btn, { backgroundColor: purple }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={st.btnText}>{loading ? 'Aguarde...' : '↑ Confirmar reabertura'}</Text>
            </Pressable>
            <Pressable style={[st.btn, st.btnGhost]} onPress={onClose} disabled={loading}>
              <Text style={st.btnGhostText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: Colors.bg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '90%' },
  header:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  headerIcon:  { fontSize: 20, color: '#fff' },
  headerTitle: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  infoBanner:  { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  infoText:    { fontSize: FontSizes.sm, lineHeight: 20 },
  field:       { gap: Spacing.xs },
  label:       { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  optionsList: { gap: Spacing.xs },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, backgroundColor: Colors.surface,
  },
  radio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.borderNormal, alignItems: 'center', justifyContent: 'center' },
  radioDot:  { width: 8, height: 8, borderRadius: 4 },
  optionLabel: { fontSize: FontSizes.sm, color: Colors.text },
  optionSub:   { fontSize: FontSizes.xs, color: Colors.textSecondary },
  textarea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: FontSizes.sm, color: Colors.text,
    minHeight: 90, textAlignVertical: 'top', backgroundColor: Colors.surface,
  },
  inputError: { borderColor: Colors.nok },
  charCount:  { fontSize: FontSizes.xs, color: Colors.textTertiary, textAlign: 'right' },
  error:      { fontSize: FontSizes.xs, color: Colors.nok },
  emptyMsg:   { fontSize: FontSizes.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  footer: { padding: Spacing.lg, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  btn:          { padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '600', fontSize: FontSizes.sm },
  btnGhost:     { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.text, fontWeight: '500', fontSize: FontSizes.sm },
});
