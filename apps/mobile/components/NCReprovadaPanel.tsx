import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { AppHeader } from './AppHeader';
import { captureNcPhoto } from '../hooks/useNcPhoto';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';
import { createNc } from '../services/nc.service';

interface Props {
  visible: boolean;
  ocorrencia: number;
  ncAnteriorId: string;
  ncAnteriorDescricao: string;
  ncAnteriorVerifNum: number;
  ncAnteriorDataCriacao: string;
  verificacaoId: string;
  verificacaoItemId: string;
  equipes: { id: string; nome: string }[];
  onSalvo: () => void;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export function NCReprovadaPanel({
  visible, ocorrencia, ncAnteriorId, ncAnteriorDescricao,
  ncAnteriorVerifNum, ncAnteriorDataCriacao,
  verificacaoId, verificacaoItemId, onSalvo,
}: Props) {
  const [descricao, setDescricao] = useState('');
  const [solucao, setSolucao] = useState('');
  const [dataVerif, setDataVerif] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [foto, setFoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!visible) return null;

  async function handleAddFoto() {
    const path = await captureNcPhoto();
    if (path) setFoto(path);
  }

  async function handleSalvar() {
    if (descricao.trim().length < 10) {
      Alert.alert('Campo obrigatório', 'Descrição deve ter pelo menos 10 caracteres.');
      return;
    }
    if (!foto) {
      Alert.alert('Foto obrigatória', 'Adicione a foto de evidência.');
      return;
    }
    if (solucao.trim().length < 10) {
      Alert.alert('Campo obrigatório', 'Solução proposta deve ter pelo menos 10 caracteres.');
      return;
    }
    if (!dataVerif) {
      Alert.alert('Campo obrigatório', 'Informe a nova data de re-inspeção.');
      return;
    }
    setIsSaving(true);
    try {
      await createNc({
        verificacaoId,
        verificacaoItemId,
        descricao: descricao.trim(),
        solucao_proposta: solucao.trim(),
        responsavel_id: null,
        data_nova_verif: dataVerif,
        foto_local_path: foto,
        nc_anterior_id: ncAnteriorId,
        numero_ocorrencia: ocorrencia,
      });
      onSalvo();
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar a NC. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  const anteriorLabel = `NC ${String(ocorrencia - 1).padStart(3, '0')} — VERIFICAÇÃO ${ncAnteriorVerifNum}`;
  const novaLabel = `NC ${String(ocorrencia).padStart(3, '0')} — VERIFICAÇÃO ${ncAnteriorVerifNum + 1}`;

  return (
    <View style={st.overlay}>
      <SafeAreaView style={st.safe}>
        <AppHeader title="RE-INSPEÇÃO" subtitle="Item reprovado novamente" showBack={false} />
        <ScrollView contentContainerStyle={st.content}>
          <View style={st.hero}>
            <View style={st.heroCircle}>
              <Text style={st.heroIcon}>✕</Text>
            </View>
            <Text style={st.heroTitle}>Item não conforme</Text>
            <Text style={st.heroSubtitle}>
              {ocorrencia}ª ocorrência · Nova NC gerada automaticamente
            </Text>
          </View>

          <Text style={st.secTitle}>NC ANTERIOR</Text>
          <View style={st.ncAnteriorCard}>
            <Text style={st.ncAnteriorLabel}>{anteriorLabel} · {fmtDate(ncAnteriorDataCriacao)}</Text>
            <Text style={st.ncAnteriorDesc}>{ncAnteriorDescricao}</Text>
            <View style={st.encerradaBadge}>
              <Text style={st.encerradaText}>Encerrada sem resolução</Text>
            </View>
          </View>

          <Text style={[st.secTitle, { marginTop: Spacing.lg }]}>NOVA NC GERADA — PREENCHER</Text>
          <View style={st.formCard}>
            <View style={st.formHeader}>
              <Text style={st.formHeaderLabel}>{novaLabel}</Text>
              <View style={st.obrigBadge}><Text style={st.obrigText}>OBRIGATÓRIO</Text></View>
            </View>

            <TextInput
              style={st.input}
              multiline
              numberOfLines={3}
              placeholder="Descrição da não conformidade *"
              placeholderTextColor={Colors.textTertiary}
              value={descricao}
              onChangeText={setDescricao}
              textAlignVertical="top"
            />

            <Pressable style={st.photoBtn} onPress={handleAddFoto}>
              {foto ? (
                <Image source={{ uri: foto }} style={st.photoThumb} resizeMode="cover" />
              ) : (
                <Text style={st.photoBtnText}>📷 Foto obrigatória *</Text>
              )}
            </Pressable>

            <TextInput
              style={st.input}
              multiline
              numberOfLines={2}
              placeholder="Solução proposta *"
              placeholderTextColor={Colors.textTertiary}
              value={solucao}
              onChangeText={setSolucao}
              textAlignVertical="top"
            />

            <View style={st.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Novo prazo *</Text>
                <TextInput
                  style={st.input}
                  value={dataVerif}
                  onChangeText={setDataVerif}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Prioridade</Text>
                <View style={st.altaBadgeBox}>
                  <Text style={st.altaText}>Alta</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={st.footer}>
          <Pressable
            style={[st.btnSalvar, isSaving && { opacity: 0.6 }]}
            onPress={handleSalvar}
            disabled={isSaving}
          >
            <Text style={st.btnSalvarText}>{isSaving ? 'Salvando...' : 'Registrar nova NC e salvar'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: Colors.bg },
  safe:    { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 20 },

  hero:         { alignItems: 'center', paddingVertical: Spacing.xl },
  heroCircle:   { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.nokBg, borderWidth: 2, borderColor: Colors.nok, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  heroIcon:     { fontSize: 28, color: Colors.nok, fontWeight: '700' },
  heroTitle:    { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.nok },
  heroSubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },

  secTitle: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: Spacing.sm },

  ncAnteriorCard:  { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderNormal, padding: Spacing.md, gap: 6 },
  ncAnteriorLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  ncAnteriorDesc:  { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 18 },
  encerradaBadge:  { alignSelf: 'flex-start', backgroundColor: Colors.surface2, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  encerradaText:   { fontSize: 10, color: Colors.textTertiary },

  formCard:        { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderNormal, overflow: 'hidden' },
  formHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface2, padding: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.borderNormal },
  formHeaderLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  obrigBadge:      { backgroundColor: Colors.brandLight, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: Colors.brand },
  obrigText:       { fontSize: 9, fontWeight: '700', color: Colors.brand, letterSpacing: 0.3 },

  input: { margin: Spacing.md, marginBottom: 0, backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.borderNormal, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSizes.base, color: Colors.text, minHeight: 48 },

  photoBtn:    { margin: Spacing.md, marginBottom: 0, height: 48, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.15)', borderStyle: 'dashed', backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoThumb:  { width: '100%', height: '100%' },
  photoBtnText: { fontSize: FontSizes.sm, color: Colors.textSecondary },

  twoCol:      { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  fieldLabel:  { fontSize: FontSizes.xs, fontWeight: '500', color: Colors.textSecondary, marginBottom: 4 },
  altaBadgeBox: { backgroundColor: Colors.nokBg, borderRadius: Radius.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 0.5, borderColor: Colors.nok, alignItems: 'center', justifyContent: 'center', height: 38 },
  altaText:    { fontSize: FontSizes.sm, color: Colors.nok, fontWeight: '600' },

  footer:       { padding: Spacing.md, paddingBottom: Spacing.xl, borderTopWidth: 0.5, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  btnSalvar:    { backgroundColor: Colors.brand, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  btnSalvarText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '600' },
});
