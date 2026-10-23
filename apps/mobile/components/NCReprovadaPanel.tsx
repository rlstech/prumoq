import { Camera, XCircle } from '../lib/icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { alertInfo } from '../lib/platform-alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { AppHeader } from './AppHeader';
import { captureNcPhoto } from '../hooks/useNcPhoto';
import { Colors, FontSizes, Radius, Spacing, FontFamily } from '../lib/constants';
import { getTodayIso } from '../lib/calendar';
import { createNc } from '../services/nc.service';

interface Props {
  clienteId: string;
  visible: boolean;
  ocorrencia: number;
  ncAnteriorId: string;
  ncAnteriorDescricao: string;
  ncAnteriorVerifNum: number;
  ncAnteriorDataCriacao: string;
  verificacaoId: string;
  verificacaoItemId: string;
  equipes: { id: string; nome: string }[];
  financialRequired: boolean;
  managers: { id: string; nome: string }[];
  onSalvo: () => void;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export function NCReprovadaPanel({
  clienteId,
  visible, ocorrencia, ncAnteriorId, ncAnteriorDescricao,
  ncAnteriorVerifNum, ncAnteriorDataCriacao,
  verificacaoId, verificacaoItemId, financialRequired, managers, onSalvo,
}: Props) {
  const [descricao, setDescricao] = useState('');
  const [solucao, setSolucao] = useState('');
  const [dataVerif, setDataVerif] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return getTodayIso(d);
  });
  const [foto, setFoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [financialManagerId, setFinancialManagerId] = useState('');

  if (!visible) return null;

  async function handleAddFoto() {
    const path = await captureNcPhoto();
    if (path) setFoto(path);
  }

  async function handleSalvar() {
    if (descricao.trim().length < 10) {
      alertInfo('Campo obrigatório', 'Descrição deve ter pelo menos 10 caracteres.');
      return;
    }
    if (!foto) {
      alertInfo('Foto obrigatória', 'Adicione a foto de evidência.');
      return;
    }
    if (solucao.trim().length < 10) {
      alertInfo('Campo obrigatório', 'Solução proposta deve ter pelo menos 10 caracteres.');
      return;
    }
    if (!dataVerif) {
      alertInfo('Campo obrigatório', 'Informe a nova data de re-inspeção.');
      return;
    }
    if (financialRequired && !financialManagerId) {
      alertInfo('Impacto financeiro', 'Selecione o gestor responsável pela avaliação financeira.');
      return;
    }
    setIsSaving(true);
    try {
      await createNc({
        clienteId,
        verificacaoId,
        verificacaoItemId,
        descricao: descricao.trim(),
        solucao_proposta: solucao.trim(),
        responsavel_id: null,
        data_nova_verif: dataVerif,
        foto_local_path: foto,
        nc_anterior_id: ncAnteriorId,
        numero_ocorrencia: ocorrencia,
        financeiro: financialRequired ? {
          situacao: 'em_avaliacao',
          bloqueio: 'nao',
          responsavelAvaliacaoId: financialManagerId,
          prazoAvaliacao: dataVerif,
        } : null,
      });
      onSalvo();
    } catch {
      alertInfo('Erro', 'Não foi possível registrar a NC. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  const anteriorLabel = `NC ${String(ocorrencia - 1).padStart(3, '0')} · verificação ${ncAnteriorVerifNum}`;
  const novaLabel = `NC ${String(ocorrencia).padStart(3, '0')} · verificação ${ncAnteriorVerifNum + 1}`;

  return (
    <View style={st.overlay}>
      <SafeAreaView edges={['top']} style={st.safe}>
        <AppHeader title="Reinspeção" subtitle="Item reprovado novamente" showBack={false} />
        <ScrollView contentContainerStyle={st.content}>
          <View style={st.hero}>
            <View style={st.heroCircle}>
              <XCircle size={31} color={Colors.nok} />
            </View>
            <Text style={st.heroTitle}>Item não conforme</Text>
            <Text style={st.heroSubtitle}>
              {ocorrencia}ª ocorrência · Nova NC gerada automaticamente
            </Text>
          </View>

          <Text style={st.secTitle}>NC anterior</Text>
          <View style={st.ncAnteriorCard}>
            <Text style={st.ncAnteriorLabel}>{anteriorLabel} · {fmtDate(ncAnteriorDataCriacao)}</Text>
            <Text style={st.ncAnteriorDesc}>{ncAnteriorDescricao}</Text>
            <View style={st.encerradaBadge}>
              <Text style={st.encerradaText}>Encerrada sem resolução</Text>
            </View>
          </View>

          <Text style={[st.secTitle, { marginTop: Spacing.lg }]}>Nova NC gerada · preencher</Text>
          <View style={st.formCard}>
            <View style={st.formHeader}>
              <Text style={st.formHeaderLabel}>{novaLabel}</Text>
              <View style={st.obrigBadge}><Text style={st.obrigText}>Obrigatório</Text></View>
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
                <View style={st.photoPlaceholder}>
                  <Camera size={20} color={Colors.nok} />
                  <Text style={st.photoBtnText}>Adicionar foto obrigatória</Text>
                </View>
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
            {financialRequired ? (
              <View style={st.financeBox}>
                <Text style={st.financeTitle}>Impacto financeiro: Em avaliação</Text>
                <Text style={st.financeHelper}>A nova ocorrência será atribuída a um gestor e não poderá ser encerrada até a definição final.</Text>
                <Text style={st.fieldLabel}>Gestor responsável *</Text>
                <View style={st.managerList}>
                  {managers.map(manager => (
                    <Pressable
                      key={manager.id}
                      onPress={() => setFinancialManagerId(manager.id)}
                      style={[st.managerOption, financialManagerId === manager.id && st.managerOptionActive]}
                    >
                      <Text style={[st.managerText, financialManagerId === manager.id && st.managerTextActive]}>{manager.nome}</Text>
                    </Pressable>
                  ))}
                </View>
                {!managers.length ? <Text style={st.financeError}>Nenhum gestor disponível para receber a avaliação.</Text> : null}
              </View>
            ) : null}
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
  heroCircle:   { width: 80, height: 80, borderRadius: Radius.full, backgroundColor: Colors.nokBg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  heroTitle:    { fontFamily: FontFamily.display, fontSize: 26, letterSpacing: -0.5, color: Colors.nok },
  heroSubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },

  secTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, color: Colors.text, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },

  ncAnteriorCard:  { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: 8 },
  ncAnteriorLabel: { fontSize: FontSizes.sm, fontFamily: FontFamily.semibold, color: Colors.text },
  ncAnteriorDesc:  { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 18 },
  encerradaBadge:  { alignSelf: 'flex-start', backgroundColor: Colors.bg, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  encerradaText:   { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Colors.textSecondary },

  formCard:        { backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', paddingBottom: Spacing.md },
  formHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, paddingBottom: Spacing.xs },
  formHeaderLabel: { fontSize: FontSizes.sm, fontFamily: FontFamily.semibold, color: Colors.text },
  obrigBadge:      { backgroundColor: Colors.brandLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  obrigText:       { fontFamily: FontFamily.bold, fontSize: FontSizes.tiny, color: Colors.brand },

  input: { margin: Spacing.md, marginBottom: 0, backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.borderNormal, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: FontSizes.base, color: Colors.text, minHeight: 48 },

  photoBtn:    { margin: Spacing.md, marginBottom: 0, minHeight: 96, borderRadius: Radius.md, backgroundColor: Colors.nokBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoThumb:  { width: '100%', height: '100%' },
  photoBtnText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  photoPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  twoCol:      { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  fieldLabel:  { fontSize: FontSizes.xs, fontFamily: FontFamily.medium, color: Colors.textSecondary, marginBottom: 4 },
  altaBadgeBox: { backgroundColor: Colors.nokBg, borderRadius: Radius.full, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', height: 48 },
  altaText:    { fontSize: FontSizes.sm, color: Colors.nok, fontFamily: FontFamily.semibold },
  financeBox: { margin: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.warnBg, gap: Spacing.sm },
  financeTitle: { fontSize: FontSizes.sm, fontFamily: FontFamily.bold, color: Colors.text },
  financeHelper: { fontSize: FontSizes.xs, color: Colors.textSecondary, lineHeight: 17 },
  managerList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  managerOption: { borderWidth: 1, borderColor: Colors.borderNormal, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, backgroundColor: Colors.surface },
  managerOptionActive: { borderColor: Colors.brand, backgroundColor: Colors.brandLight },
  managerText: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  managerTextActive: { color: Colors.brand, fontFamily: FontFamily.bold },
  financeError: { fontSize: FontSizes.xs, color: Colors.nok },

  footer:       { padding: Spacing.lg, paddingBottom: Spacing.xl, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, backgroundColor: Colors.surface },
  btnSalvar:    { backgroundColor: Colors.brand, borderRadius: Radius.full, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  btnSalvarText: { color: Colors.surface, fontSize: FontSizes.md, fontFamily: FontFamily.bold },
});
