import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  Image as ImageIcon,
  PenLine,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PhotoGrid } from '../../../../../../../../../../components/PhotoGrid';
import { SignatureField } from '../../../../../../../../../../components/SignatureField';
import { captureNcPhoto } from '../../../../../../../../../../hooks/useNcPhoto';
import { usePhotoCapture } from '../../../../../../../../../../hooks/usePhotoCapture';
import { Colors, Radius, Spacing } from '../../../../../../../../../../lib/constants';
import { db } from '../../../../../../../../../../lib/powersync';
import { supabase } from '../../../../../../../../../../lib/supabase';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
}

type Resultado = 'conforme' | 'nao_conforme' | 'na';
type Conclusao = 'conforme' | 'nao_conforme' | 'em_andamento';

interface ItemRow { id: string; ordem: number; titulo: string; metodo_verif: string; tolerancia: string }
interface EquipeRow { id: string; nome: string; tipo: string }
interface FvsRow { id: string; subservico: string; revisao_associada: number }
interface UsuarioRow { id: string; nome: string; cargo: string }
interface CountRow { count: number }

interface NcDetail {
  descricao: string;
  solucao_proposta: string;
  data_nova_verif: string;
  responsavel_id: string;
  foto: string | null;
}

// ── Custom Slider (sem dependência externa) ──────────────────────────────────
function CustomSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackWidth = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(100, (x / trackWidth.current) * 100));
        onChange(Math.round(pct / 5) * 5);
      },
      onPanResponderMove: evt => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(100, (x / trackWidth.current) * 100));
        onChange(Math.round(pct / 5) * 5);
      },
    })
  ).current;

  return (
    <View style={sliderSt.row}>
      <View
        style={sliderSt.track}
        onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        <View style={[sliderSt.fill, { width: `${value}%` as any }]} />
      </View>
      <Text style={sliderSt.value}>{value}%</Text>
    </View>
  );
}

const sliderSt = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%' as any, backgroundColor: Colors.brand },
  value: { width: 40, textAlign: 'right', fontSize: 13, color: Colors.brand, fontWeight: '500' },
});

// ── NC Panel ─────────────────────────────────────────────────────────────────
function NcPanel({
  visible,
  detail,
  onChange,
  onAddPhoto,
  equipes,
}: {
  visible: boolean;
  detail: NcDetail;
  onChange: (d: Partial<NcDetail>) => void;
  onAddPhoto: () => void;
  equipes: EquipeRow[];
}) {
  const [showRespPicker, setShowRespPicker] = useState(false);
  if (!visible) return null;

  const selectedResp = equipes.find(e => e.id === detail.responsavel_id);
  const photoUri = detail.foto
    ? (detail.foto.startsWith('pending:') ? detail.foto.slice(8) : detail.foto)
    : null;

  return (
    <View style={ncSt.panel}>
      {/* Picker de responsável */}
      <Modal visible={showRespPicker} transparent animationType="fade">
        <Pressable style={ncSt.overlay} onPress={() => setShowRespPicker(false)}>
          <View style={ncSt.pickerBox}>
            <Text style={ncSt.pickerTitle}>Responsável pela correção</Text>
            <ScrollView>
              {equipes.map(eq => (
                <Pressable
                  key={eq.id}
                  style={[ncSt.pickerItem, detail.responsavel_id === eq.id && ncSt.pickerItemActive]}
                  onPress={() => { onChange({ responsavel_id: eq.id }); setShowRespPicker(false); }}
                >
                  <Text style={[ncSt.pickerItemText, detail.responsavel_id === eq.id && ncSt.pickerItemTextActive]}>
                    {eq.nome}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <View style={ncSt.header}>
        <Text style={ncSt.title}>Registro de não conformidade</Text>
        <View style={ncSt.badge}><Text style={ncSt.badgeText}>Obrigatório</Text></View>
      </View>

      <Text style={ncSt.label}>Descrição da não conformidade *</Text>
      <TextInput
        style={ncSt.input}
        multiline
        numberOfLines={2}
        placeholder="Descreva o problema encontrado..."
        placeholderTextColor={Colors.textTertiary}
        value={detail.descricao}
        onChangeText={t => onChange({ descricao: t })}
      />

      <Text style={ncSt.label}>Foto da evidência *</Text>
      {photoUri ? (
        <View style={ncSt.photoRow}>
          <Image source={{ uri: photoUri }} style={ncSt.photoThumb} />
          <Text style={ncSt.photoOk}>✓ Foto adicionada</Text>
          <Pressable onPress={() => onChange({ foto: null })}>
            <Text style={ncSt.photoRemove}>Remover</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={ncSt.photoBtn} onPress={onAddPhoto}>
          <Camera size={14} color={Colors.nok} />
          <Text style={ncSt.photoBtnText}>Tirar foto da evidência</Text>
        </Pressable>
      )}

      <Text style={ncSt.label}>Solução proposta *</Text>
      <TextInput
        style={ncSt.input}
        multiline
        numberOfLines={2}
        placeholder="Descreva a ação corretiva..."
        placeholderTextColor={Colors.textTertiary}
        value={detail.solucao_proposta}
        onChangeText={t => onChange({ solucao_proposta: t })}
      />

      {/* Date + Responsável em 2 colunas */}
      <View style={ncSt.twoCol}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ncSt.label}>Nova data de verif. *</Text>
          <TextInput
            style={ncSt.input}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={Colors.textTertiary}
            value={detail.data_nova_verif}
            onChangeText={t => onChange({ data_nova_verif: t })}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ncSt.label}>Responsável</Text>
          <Pressable style={ncSt.selectBtn} onPress={() => setShowRespPicker(true)}>
            <Text style={ncSt.selectText} numberOfLines={1}>
              {selectedResp ? selectedResp.nome : 'Selecionar...'}
            </Text>
            <ChevronDown size={11} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const ncSt = StyleSheet.create({
  panel: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.nok,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  header:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title:     { fontSize: 12, fontWeight: '500', color: Colors.nok },
  badge:     { backgroundColor: Colors.nok, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  label:     { fontSize: 11, fontWeight: '500', color: Colors.nok },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: '#f09595',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 12,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  photoRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoThumb:  { width: 52, height: 52, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.nok },
  photoOk:     { flex: 1, fontSize: 11, color: Colors.ok, fontWeight: '500' },
  photoRemove: { fontSize: 11, color: Colors.nok },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 9,
    borderWidth: 0.5, borderStyle: 'dashed', borderColor: Colors.nok,
    borderRadius: Radius.sm, backgroundColor: Colors.surface,
  },
  photoBtnText: { fontSize: 12, color: Colors.nok, fontWeight: '500' },
  twoCol:    { flexDirection: 'row', gap: Spacing.sm },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm, borderWidth: 0.5, borderColor: '#f09595',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    minHeight: 34,
  },
  selectText: { flex: 1, fontSize: 12, color: Colors.text },
  // picker modal
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  pickerBox:     { width: '90%', maxHeight: 280, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md },
  pickerTitle:   { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  pickerItem:    { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  pickerItemActive:     { backgroundColor: Colors.progressBg },
  pickerItemText:       { fontSize: 13, color: Colors.text },
  pickerItemTextActive: { color: Colors.progress, fontWeight: '500' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NovaVerificacaoScreen() {
  const { id, ambId, fvsId } = useLocalSearchParams<{ id: string; ambId: string; fvsId: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Queries
  const { data: usuarioRows } = useQuery<UsuarioRow>(`SELECT id, nome, cargo FROM usuarios LIMIT 1`);
  const usuario = usuarioRows[0];

  const { data: fvsRows } = useQuery<FvsRow>(`
    SELECT id, subservico, revisao_associada FROM fvs_planejadas WHERE id = ?
  `, [fvsId]);
  const fvs = fvsRows[0];

  const { data: itens } = useQuery<ItemRow>(`
    SELECT fpi.id, fpi.ordem, fpi.titulo, fpi.metodo_verif, fpi.tolerancia
    FROM fvs_padrao_itens fpi
    JOIN fvs_planejadas fp ON fp.fvs_padrao_id = fpi.fvs_padrao_id
      AND fpi.revisao = fp.revisao_associada
    WHERE fp.id = ?
    ORDER BY fpi.ordem
  `, [fvsId]);

  const { data: equipes } = useQuery<EquipeRow>(`
    SELECT id, nome, tipo FROM equipes WHERE ativo = 1 ORDER BY nome
  `);

  const { data: countRows } = useQuery<CountRow>(`
    SELECT COUNT(*) AS count FROM verificacoes WHERE fvs_planejada_id = ?
  `, [fvsId]);
  const proximoNumero = (countRows[0]?.count ?? 0) + 1;

  // Form state
  const [dataVerif, setDataVerif] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [showEquipePicker, setShowEquipePicker] = useState(false);
  const [percentExec, setPercentExec] = useState<number>(0);
  const [itemResults, setItemResults] = useState<Record<string, Resultado>>({});
  const [ncDetails, setNcDetails] = useState<Record<string, NcDetail>>({});
  const [observacoes, setObservacoes] = useState('');
  const [conclusao, setConclusao] = useState<Conclusao | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { photos: generalPhotos, addFromCamera, addFromGallery, removePhoto } = usePhotoCapture();

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const selectedEquipe = equipes.find(e => e.id === selectedEquipeId) ?? null;

  function setItemResult(itemId: string, result: Resultado) {
    setItemResults(prev => ({ ...prev, [itemId]: result }));
    if (result !== 'nao_conforme') {
      setNcDetails(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } else {
      setNcDetails(prev => ({
        ...prev,
        [itemId]: prev[itemId] ?? { descricao: '', solucao_proposta: '', data_nova_verif: '', responsavel_id: '', foto: null },
      }));
    }
  }

  function updateNc(itemId: string, patch: Partial<NcDetail>) {
    setNcDetails(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  async function addNcPhoto(itemId: string) {
    const path = await captureNcPhoto();
    if (path) updateNc(itemId, { foto: path });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!selectedEquipeId) errs.equipe = 'Selecione a equipe executora';
    if (!conclusao) errs.conclusao = 'Selecione o resultado da verificação';
    if (!signaturePath) errs.assinatura = 'Assinatura digital obrigatória';

    for (const item of itens) {
      if (!itemResults[item.id]) errs[`item_${item.id}`] = 'Classifique este item';
      if (itemResults[item.id] === 'nao_conforme') {
        const nc = ncDetails[item.id];
        if (!nc?.descricao)        errs[`nc_desc_${item.id}`] = 'Descrição obrigatória';
        if (!nc?.foto)             errs[`nc_foto_${item.id}`] = 'Foto obrigatória';
        if (!nc?.solucao_proposta) errs[`nc_sol_${item.id}`]  = 'Solução obrigatória';
        if (!nc?.data_nova_verif)  errs[`nc_data_${item.id}`] = 'Data obrigatória';
      }
    }

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      // Rola para o topo para o usuário ver os erros destacados
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      Alert.alert(
        'Campos obrigatórios',
        'Verifique os campos destacados em vermelho e tente novamente.'
      );
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setIsSaving(true);

    const verificacaoId = uuid();
    const now = new Date().toISOString();

    try {
      await db.execute(`
        INSERT INTO verificacoes
          (id, fvs_planejada_id, numero_verif, inspetor_id, data_verif,
           percentual_exec, status, observacoes, created_offline, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        verificacaoId, fvsId, proximoNumero,
        userId ?? '', dataVerif,
        percentExec, conclusao ?? 'em_andamento',
        observacoes, 1, now,
      ]);

      for (const item of itens) {
        const resultado = itemResults[item.id] ?? 'na';
        const itemVerifId = uuid();
        await db.execute(`
          INSERT INTO verificacao_itens
            (id, verificacao_id, fvs_padrao_item_id, ordem, titulo,
             metodo_verif, tolerancia, resultado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [itemVerifId, verificacaoId, item.id, item.ordem,
            item.titulo, item.metodo_verif, item.tolerancia, resultado]);

        if (resultado === 'nao_conforme') {
          const nc = ncDetails[item.id];
          if (nc) {
            const ncId = uuid();
            await db.execute(`
              INSERT INTO nao_conformidades
                (id, verificacao_id, verificacao_item_id, descricao,
                 solucao_proposta, responsavel_id, data_nova_verif,
                 status, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [ncId, verificacaoId, itemVerifId, nc.descricao,
                nc.solucao_proposta, nc.responsavel_id || null,
                nc.data_nova_verif, 'aberta', now]);

            if (nc.foto) {
              await db.execute(`
                INSERT INTO nc_fotos
                  (id, nc_id, r2_key, nome_arquivo, mime_type, ordem)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [uuid(), ncId, `pending:${nc.foto}`, nc.foto.split('/').pop() ?? 'nc.jpg', 'image/jpeg', 0]);
            }
          }
        }
      }

      for (let i = 0; i < generalPhotos.length; i++) {
        const localPath = generalPhotos[i];
        await db.execute(`
          INSERT INTO verificacao_fotos
            (id, verificacao_id, r2_key, nome_arquivo, mime_type, ordem)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [uuid(), verificacaoId, `pending:${localPath}`, localPath.split('/').pop() ?? 'photo.jpg', 'image/jpeg', i]);
      }

      if (signaturePath) {
        await db.execute(
          `UPDATE verificacoes SET assinatura_url = ?, assinada_em = ? WHERE id = ?`,
          [`pending:${signaturePath}`, now, verificacaoId]
        );
      }

      router.back();
    } catch (err) {
      console.error('[NovaVerificacao] save error:', err);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  const conclusaoOptions: { key: Conclusao; label: string; color: string; bgColor: string }[] = [
    { key: 'conforme',     label: '✓ Conforme',     color: Colors.ok,       bgColor: Colors.okBg },
    { key: 'nao_conforme', label: '✗ Não conforme', color: Colors.nok,      bgColor: Colors.nokBg },
    { key: 'em_andamento', label: '→ Em andamento', color: Colors.progress, bgColor: Colors.progressBg },
  ];

  const inspectorInitials = usuario?.nome ? getInitials(usuario.nome) : 'IN';

  return (
    <SafeAreaView style={st.safe}>
      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View style={st.headerText}>
          <Text style={st.title}>Nova Verificação</Text>
          <Text style={st.subtitle}>Verif. #{proximoNumero} · {fvs?.subservico ?? 'FVS'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={st.content}>

          {/* ── 1. Inspetor ── */}
          <View style={st.inspectorCard}>
            <View style={st.inspectorAvatar}>
              <Text style={st.inspectorAvatarText}>{inspectorInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.inspectorName}>{usuario?.nome ?? 'Inspetor'}</Text>
              <Text style={st.inspectorRole}>{usuario?.cargo ?? 'Inspetor de Campo'}</Text>
            </View>
            <View style={st.logadoBadge}>
              <Text style={st.logadoText}>Logado</Text>
            </View>
          </View>

          {/* ── 2. Data ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Data da verificação</Text>
            {Platform.OS === 'web' ? (
              // @ts-ignore — input HTML nativo no PWA
              <input
                type="date"
                value={dataVerif}
                onChange={(e: any) => setDataVerif(e.target.value)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 6,
                  border: '0.5px solid rgba(0,0,0,0.12)',
                  padding: '9px 12px',
                  fontSize: 13,
                  color: '#1A1A18',
                  width: '100%',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <TextInput
                style={st.input}
                value={dataVerif}
                onChangeText={setDataVerif}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            )}
          </View>

          {/* ── 3. Equipe executora ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Responsável técnico e equipe executora</Text>
            {errors.equipe && <Text style={st.errorText}>{errors.equipe}</Text>}

            {/* Picker modal */}
            <Modal visible={showEquipePicker} transparent animationType="fade">
              <Pressable style={ncSt.overlay} onPress={() => setShowEquipePicker(false)}>
                <View style={ncSt.pickerBox}>
                  <Text style={ncSt.pickerTitle}>Equipe executora</Text>
                  <ScrollView>
                    {equipes.map(eq => (
                      <Pressable
                        key={eq.id}
                        style={[ncSt.pickerItem, selectedEquipeId === eq.id && ncSt.pickerItemActive]}
                        onPress={() => { setSelectedEquipeId(eq.id); setShowEquipePicker(false); }}
                      >
                        <Text style={[ncSt.pickerItemText, selectedEquipeId === eq.id && ncSt.pickerItemTextActive]}>
                          {eq.nome}
                        </Text>
                        <Text style={st.equipePickerTipo}>{eq.tipo}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>

            <View style={st.teamCard}>
              <Pressable style={st.teamSelect} onPress={() => setShowEquipePicker(true)}>
                <Text style={st.teamSelectLabel}>Equipe executora deste serviço</Text>
                <View style={st.teamSelectBtn}>
                  <Text style={st.teamSelectBtnText} numberOfLines={1}>
                    {selectedEquipe ? selectedEquipe.nome : 'Selecionar equipe...'}
                  </Text>
                  <ChevronDown size={14} color={Colors.textSecondary} />
                </View>
              </Pressable>

              {selectedEquipe && (
                <>
                  <View style={st.teamDivider} />
                  <View style={st.teamSelected}>
                    <View style={st.teamAvatar}>
                      <Text style={st.teamAvatarText}>{getInitials(selectedEquipe.nome)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.teamName}>{selectedEquipe.nome}</Text>
                    </View>
                    <View style={[
                      st.tipoBadge,
                      selectedEquipe.tipo?.toLowerCase().includes('terceir')
                        ? st.tipoBadgeBlue
                        : st.tipoBadgeGreen,
                    ]}>
                      <Text style={[
                        st.tipoBadgeText,
                        selectedEquipe.tipo?.toLowerCase().includes('terceir')
                          ? st.tipoBadgeTextBlue
                          : st.tipoBadgeTextGreen,
                      ]}>
                        {selectedEquipe.tipo ?? 'Próprio'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── 4. Percentual de execução ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Percentual de execução</Text>
            <CustomSlider value={percentExec} onChange={setPercentExec} />
          </View>

          {/* ── 5. Itens de verificação ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Itens de verificação</Text>
            {itens.map((item, idx) => {
              const result = itemResults[item.id];
              const isNok = result === 'nao_conforme';
              return (
                <View
                  key={item.id}
                  style={[st.itemWrapper, isNok && st.itemWrapperNok]}
                >
                  {/* Layer 1: Header */}
                  <View style={[st.itemHeader, isNok && st.itemHeaderNok]}>
                    <View style={[st.itemNum, isNok && st.itemNumNok]}>
                      <Text style={[st.itemNumText, isNok && st.itemNumTextNok]}>{idx + 1}</Text>
                    </View>
                    <Text style={st.itemTitulo} numberOfLines={3}>{item.titulo}</Text>
                  </View>

                  {/* Layer 2: Método + Tolerância */}
                  {(item.metodo_verif || item.tolerancia) ? (
                    <View style={st.itemMethod}>
                      <View style={{ flex: 1 }}>
                        {item.metodo_verif ? (
                          <>
                            <Text style={st.itemMethodLabel}>MÉTODO</Text>
                            <Text style={st.itemMethodText}>{item.metodo_verif}</Text>
                          </>
                        ) : null}
                      </View>
                      {item.tolerancia ? (
                        <View style={st.toleranciaBadge}>
                          <Text style={st.toleranciaLabel}>TOLERÂNCIA</Text>
                          <Text style={st.toleranciaText}>{item.tolerancia}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Layer 3: Botões de resultado + NC panel */}
                  <View style={st.itemActions}>
                    {errors[`item_${item.id}`] && (
                      <Text style={st.errorText}>{errors[`item_${item.id}`]}</Text>
                    )}
                    <View style={st.resultRow}>
                      {(['conforme', 'nao_conforme', 'na'] as Resultado[]).map(r => (
                        <Pressable
                          key={r}
                          style={[st.resultBtn, result === r && resultBtnActive(r)]}
                          onPress={() => setItemResult(item.id, r)}
                        >
                          <Text style={[st.resultBtnText, result === r && resultBtnTextActive()]}>
                            {r === 'conforme' ? '✓ Conforme' : r === 'nao_conforme' ? '✗ Não conforme' : '- N/A'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {isNok && (
                      <NcPanel
                        visible
                        detail={ncDetails[item.id] ?? { descricao: '', solucao_proposta: '', data_nova_verif: '', responsavel_id: '', foto: null }}
                        onChange={patch => updateNc(item.id, patch)}
                        onAddPhoto={() => addNcPhoto(item.id)}
                        equipes={equipes}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── 6. Fotos gerais ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Fotos de evidência</Text>
            <View style={st.photoBtns}>
              <Pressable style={st.photoActionBtn} onPress={addFromCamera}>
                <Camera size={15} color={Colors.progress} />
                <Text style={st.photoActionText}>Câmera</Text>
              </Pressable>
              <Pressable style={st.photoActionBtn} onPress={addFromGallery}>
                <ImageIcon size={15} color={Colors.progress} />
                <Text style={st.photoActionText}>Galeria</Text>
              </Pressable>
              <Text style={st.photoCount}>{generalPhotos.length}/10</Text>
            </View>
            {generalPhotos.length > 0 && (
              <PhotoGrid photos={generalPhotos} max={10} onRemove={removePhoto} />
            )}
          </View>

          {/* ── 7. Observações ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Observações gerais</Text>
            <TextInput
              style={[st.input, { height: 80 }]}
              multiline
              placeholder="Ocorrências, condições do ambiente..."
              placeholderTextColor={Colors.textTertiary}
              value={observacoes}
              onChangeText={setObservacoes}
              textAlignVertical="top"
            />
          </View>

          {/* ── 8. Conclusão ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Conclusão desta verificação</Text>
            {errors.conclusao && <Text style={st.errorText}>{errors.conclusao}</Text>}
            <View style={st.conclusaoRow}>
              {conclusaoOptions.map(opt => (
                <Pressable
                  key={opt.key}
                  style={[
                    st.conclusaoBtn,
                    conclusao === opt.key && { backgroundColor: opt.bgColor, borderColor: opt.color },
                  ]}
                  onPress={() => setConclusao(opt.key)}
                >
                  <Text style={[
                    st.conclusaoBtnText,
                    conclusao === opt.key && { color: opt.color, fontWeight: '600' },
                  ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── 9. Assinatura digital ── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Assinatura digital</Text>
            <Text style={st.signatureResponsavel}>
              Responsável: <Text style={{ color: Colors.text, fontWeight: '500' }}>{usuario?.nome ?? '—'}</Text>
            </Text>
            {errors.assinatura && <Text style={st.errorText}>{errors.assinatura}</Text>}
            {signaturePath ? (
              <View style={st.signedConfirm}>
                <PenLine size={15} color={Colors.ok} />
                <Text style={st.signedText}>✓ Assinatura registrada</Text>
                <Pressable onPress={() => {
                  setSignaturePath(null);
                  if (Platform.OS !== 'web') setShowSignature(true);
                }}>
                  <Text style={st.refazerText}>Refazer</Text>
                </Pressable>
              </View>
            ) : Platform.OS === 'web' ? (
              /* Web: canvas inline com botões visíveis */
              <SignatureField
                visible
                inline
                onSign={path => setSignaturePath(path)}
                onCancel={() => {}}
              />
            ) : (
              /* Native: área clicável que abre modal */
              <Pressable
                style={[st.signatureArea, errors.assinatura && { borderColor: Colors.nok }]}
                onPress={() => setShowSignature(true)}
              >
                <PenLine size={20} color={errors.assinatura ? Colors.nok : Colors.textTertiary} />
                <Text style={[st.signatureHint, errors.assinatura && { color: Colors.nok }]}>
                  Toque para assinar
                </Text>
              </Pressable>
            )}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de assinatura — apenas nativo */}
      {Platform.OS !== 'web' && (
        <SignatureField
          visible={showSignature}
          onSign={path => { setSignaturePath(path); setShowSignature(false); }}
          onCancel={() => setShowSignature(false)}
        />
      )}

      {/* Fixed save button */}
      <View style={st.saveBar}>
        <Pressable
          style={[st.saveBtn, isSaving && st.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={st.saveBtnText}>Salvar verificação</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function resultBtnActive(r: Resultado): object {
  if (r === 'conforme')     return { backgroundColor: Colors.ok,       borderColor: Colors.ok };
  if (r === 'nao_conforme') return { backgroundColor: Colors.nok,      borderColor: Colors.nok };
  return                           { backgroundColor: Colors.na,       borderColor: Colors.na };
}
function resultBtnTextActive(): object {
  return { color: '#fff' };
}

const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  {
    backgroundColor: Colors.brand,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md, paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  headerText: { flex: 1 },
  title:      { color: '#fff', fontSize: 19, fontWeight: '500' },
  subtitle:   { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 },
  content:    { padding: Spacing.lg, gap: Spacing.lg },
  section:    { gap: Spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary, marginBottom: 4 },

  // Inspector card
  inspectorCard: {
    backgroundColor: Colors.brandLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  inspectorAvatar: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  inspectorAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  inspectorName:       { fontSize: 13, fontWeight: '500', color: Colors.brand },
  inspectorRole:       { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  logadoBadge: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 0.5, borderColor: Colors.borderNormal,
  },
  logadoText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },

  // Input
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 0.5, borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 13, color: Colors.text,
  },

  // Equipe
  teamCard: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  teamSelect: { padding: Spacing.md, gap: 6 },
  teamSelectLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  teamSelectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  teamSelectBtnText: { flex: 1, fontSize: 13, color: Colors.text },
  teamDivider: { height: 0.5, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: Spacing.md },
  teamSelected: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.sm,
    backgroundColor: Colors.okBg,
  },
  teamAvatar: {
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.ok,
    alignItems: 'center', justifyContent: 'center',
  },
  teamAvatarText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  teamName:        { fontSize: 12, fontWeight: '500', color: Colors.text },
  tipoBadge:       { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tipoBadgeGreen:  { backgroundColor: Colors.okBg },
  tipoBadgeBlue:   { backgroundColor: Colors.progressBg },
  tipoBadgeText:       { fontSize: 10, fontWeight: '500' },
  tipoBadgeTextGreen:  { color: Colors.ok },
  tipoBadgeTextBlue:   { color: Colors.progress },
  equipePickerTipo:    { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  // Checklist item — 3 camadas
  itemWrapper: {
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.borderNormal,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  itemWrapperNok: { borderColor: Colors.nok },

  itemHeader: {
    backgroundColor: Colors.surface2,
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 13, paddingVertical: 11,
    gap: Spacing.sm,
  },
  itemHeaderNok: { backgroundColor: Colors.nokBg },

  itemNum: {
    width: 20, height: 20, borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  itemNumNok: { backgroundColor: Colors.nokBg, borderWidth: 0.5, borderColor: Colors.nok },
  itemNumText:    { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  itemNumTextNok: { color: Colors.nok },
  itemTitulo:     { flex: 1, fontSize: 13, fontWeight: '500', color: Colors.text, lineHeight: 18 },

  itemMethod: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 13, paddingVertical: 9,
    gap: 10,
  },
  itemMethodLabel: { fontSize: 10, fontWeight: '500', color: Colors.textTertiary, letterSpacing: 0.4, marginBottom: 2 },
  itemMethodText:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  toleranciaBadge: { alignItems: 'flex-end' },
  toleranciaLabel: { fontSize: 10, fontWeight: '500', color: Colors.textTertiary, letterSpacing: 0.4, marginBottom: 2 },
  toleranciaText:  { fontSize: 12, fontWeight: '500', color: Colors.progress },

  itemActions: {
    backgroundColor: Colors.surface2,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 13, paddingVertical: 10,
    gap: Spacing.sm,
  },

  resultRow: { flexDirection: 'row', gap: 5 },
  resultBtn: {
    flex: 1,
    borderRadius: 5,
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  resultBtnText: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },

  // Photos
  photoBtns:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  photoActionText: { fontSize: 13, color: Colors.progress, fontWeight: '500' },
  photoCount:      { fontSize: 12, color: Colors.textTertiary, marginLeft: 'auto' as any },

  // Conclusão
  conclusaoRow: { flexDirection: 'row', gap: Spacing.sm },
  conclusaoBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.borderNormal,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  conclusaoBtnText: { fontSize: 10, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },

  // Assinatura
  signatureResponsavel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  signedConfirm: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.okBg,
    borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.ok,
    padding: Spacing.md, gap: Spacing.sm,
  },
  signedText:  { flex: 1, fontSize: 12, color: Colors.ok, fontWeight: '500' },
  refazerText: { fontSize: 11, color: Colors.nok, fontWeight: '500' },
  signatureArea: {
    height: 100,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs,
  },
  signatureHint: { fontSize: 11, color: Colors.textTertiary },

  // Save bar
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn:         { backgroundColor: Colors.brand, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontSize: 15, fontWeight: '600' },

  errorText: { fontSize: 11, color: Colors.nok, fontWeight: '500' },
});
