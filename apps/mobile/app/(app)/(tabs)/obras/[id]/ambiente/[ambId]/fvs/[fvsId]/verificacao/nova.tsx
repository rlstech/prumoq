import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams } from 'expo-router';
import { goBack } from '../../../../../../../../../../lib/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  Image as ImageIcon,
  LockKeyhole,
  Minus,
  PenLine,
  Save,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader } from '../../../../../../../../../../components/AppHeader';
import { NCReinspectionBanner } from '../../../../../../../../../../components/NCReinspectionBanner';
import { NCReprovadaPanel } from '../../../../../../../../../../components/NCReprovadaPanel';
import { NCResolvedScreen } from '../../../../../../../../../../components/NCResolvedScreen';
import { PhotoGrid } from '../../../../../../../../../../components/PhotoGrid';
import { SignatureField } from '../../../../../../../../../../components/SignatureField';
import {
  BottomActionBar,
  Button,
  Card,
  Chip,
  ErrorBanner,
  SectionTitle,
  SegmentedControl,
  Stepper,
} from '../../../../../../../../../../components/ui';
import { captureNcPhoto } from '../../../../../../../../../../hooks/useNcPhoto';
import { usePhotoCapture } from '../../../../../../../../../../hooks/usePhotoCapture';
import { useResponsiveLayout } from '../../../../../../../../../../hooks/useResponsiveLayout';
import { useVerificationFlow } from '../../../../../../../../../../hooks/useVerificationFlow';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../../../../../../../../../lib/constants';
import { db } from '../../../../../../../../../../lib/powersync';
import { supabase } from '../../../../../../../../../../lib/supabase';
import {
  makeDraftId,
  NcDraftDetail,
  VerificationMode,
  VerificationResult,
  VerificationStep,
} from '../../../../../../../../../../lib/verification/draft.types';
import {
  canConcludeFvs,
  verificationStatusFromResults,
} from '../../../../../../../../../../lib/verification/controller';
import { approveReinspecao, createNc, reprovarReinspecao } from '../../../../../../../../../../services/nc.service';

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

type Resultado = VerificationResult;

interface ItemRow { id: string; ordem: number; titulo: string; metodo_verif: string; tolerancia: string }
interface EquipeRow { id: string; nome: string; tipo: string }
interface FvsRow { id: string; subservico: string; revisao_associada: number; status: string }
interface UsuarioRow { id: string; nome: string; cargo: string }
interface CountRow { count: number }
interface NcAbertaRow {
  nc_id: string;
  fvs_padrao_item_id: string;
  titulo: string;
  descricao: string;
  numero_ocorrencia: number;
  data_nova_verif: string | null;
  responsavel_id: string | null;
  numero_verif: number;
  nc_data_criacao: string;
}

type ReinspResult =
  | { type: 'idle' }
  | { type: 'aprovada'; itemTitle: string; abertoEm: string | null; resolvidoEm: string; responsavelNome: string | null; fotoUri: string | null }
  | { type: 'reprovada'; ocorrencia: number; ncAnteriorId: string; ncAnteriorDescricao: string; ncAnteriorVerifNum: number; ncAnteriorDataCriacao: string; verificacaoId: string; verificacaoItemId: string };

interface UltimaVerifItemRow {
  fvs_padrao_item_id: string;
  resultado: string;
}

type NcDetail = NcDraftDetail;

type ChecklistFilter = 'pending' | 'all' | 'nc';

// ── NC Panel ─────────────────────────────────────────────────────────────────
function NcPanel({
  visible,
  detail,
  onChange,
  onAddPhoto,
  equipes,
  responsibleError,
}: {
  visible: boolean;
  detail: NcDetail;
  onChange: (d: Partial<NcDetail>) => void;
  onAddPhoto: () => void;
  equipes: EquipeRow[];
  responsibleError?: string;
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
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={detail.data_nova_verif}
              onChange={(event: { target: { value: string } }) => onChange({ data_nova_verif: event.target.value })}
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 6,
                border: '0.5px solid rgba(0,0,0,0.12)',
                padding: '7px 10px',
                fontSize: FontSizes.tiny,
                color: Colors.text,
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <TextInput
              style={ncSt.input}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={Colors.textTertiary}
              value={detail.data_nova_verif}
              onChangeText={t => onChange({ data_nova_verif: t })}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ncSt.label}>Responsável *</Text>
          <Pressable style={[ncSt.selectBtn, responsibleError && ncSt.selectError]} onPress={() => setShowRespPicker(true)}>
            <Text style={ncSt.selectText} numberOfLines={1}>
              {selectedResp ? selectedResp.nome : 'Selecionar...'}
            </Text>
            <ChevronDown size={11} color={Colors.textSecondary} />
          </Pressable>
          {responsibleError ? <Text style={ncSt.errorText}>{responsibleError}</Text> : null}
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
  title:     { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.nok },
  badge:     { backgroundColor: Colors.nok, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: FontSizes.tiny, color: Colors.surface, fontWeight: '600' },
  label:     { fontSize: FontSizes.xs, fontWeight: '500', color: Colors.nok },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.nok,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSizes.sm,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  photoRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoThumb:  { width: 52, height: 52, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.nok },
  photoOk:     { flex: 1, fontSize: FontSizes.xs, color: Colors.ok, fontWeight: '500' },
  photoRemove: { fontSize: FontSizes.xs, color: Colors.nok },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 9,
    borderWidth: 0.5, borderStyle: 'dashed', borderColor: Colors.nok,
    borderRadius: Radius.sm, backgroundColor: Colors.surface,
  },
  photoBtnText: { fontSize: FontSizes.sm, color: Colors.nok, fontWeight: '500' },
  twoCol:    { flexDirection: 'row', gap: Spacing.sm },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.nok,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    minHeight: 34,
  },
  selectError: { borderColor: Colors.nok, borderWidth: 1.5 },
  selectText: { flex: 1, fontSize: FontSizes.sm, color: Colors.text },
  errorText: { fontSize: FontSizes.tiny, color: Colors.nok, fontFamily: FontFamily.semibold },
  // picker modal
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  pickerBox:     { width: '90%', maxHeight: 280, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md },
  pickerTitle:   { fontSize: FontSizes.base, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  pickerItem:    { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  pickerItemActive:     { backgroundColor: Colors.progressBg },
  pickerItemText:       { fontSize: FontSizes.base, color: Colors.text },
  pickerItemTextActive: { color: Colors.progress, fontWeight: '500' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NovaVerificacaoScreen() {
  const { id, ambId, fvsId } = useLocalSearchParams<{ id: string; ambId: string; fvsId: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const { isTablet } = useResponsiveLayout();

  // Queries
  const { data: usuarioRows } = useQuery<UsuarioRow>(`SELECT id, nome, cargo FROM usuarios LIMIT 1`);
  const usuario = usuarioRows[0];

  const { data: fvsRows } = useQuery<FvsRow>(`
    SELECT id, subservico, revisao_associada, status FROM fvs_planejadas WHERE id = ?
  `, [fvsId]);
  const fvs = fvsRows[0];

  const { data: ambienteRows } = useQuery<{ nome: string }>(`
    SELECT a.nome FROM ambientes a JOIN obras o ON o.id = a.obra_id WHERE a.id = ?
  `, [ambId]);
  const ambienteNome = ambienteRows[0]?.nome ?? '';

  const { data: lastEquipeRows } = useQuery<{ equipe_id: string | null }>(`
    SELECT equipe_id FROM verificacoes WHERE fvs_planejada_id = ? ORDER BY created_at DESC LIMIT 1
  `, [fvsId]);

  const { data: itens } = useQuery<ItemRow>(`
    SELECT fpi.id, fpi.ordem, fpi.titulo, fpi.metodo_verif, fpi.tolerancia
    FROM fvs_padrao_itens fpi
    JOIN fvs_planejadas fp ON fp.fvs_padrao_id = fpi.fvs_padrao_id
      AND fpi.revisao = fp.revisao_associada
    WHERE fp.id = ?
    ORDER BY fpi.ordem
  `, [fvsId]);

  const { data: equipes } = useQuery<EquipeRow>(`
    SELECT e.id, e.nome, e.tipo
    FROM equipes e
    JOIN obra_equipes oe ON oe.equipe_id = e.id
    WHERE oe.obra_id = ? AND e.ativo = 1
    ORDER BY e.nome
  `, [id]);

  const { data: countRows } = useQuery<CountRow>(`
    SELECT COUNT(*) AS count FROM verificacoes WHERE fvs_planejada_id = ?
  `, [fvsId]);
  const proximoNumero = (countRows[0]?.count ?? 0) + 1;

  const { data: conclusionCountRows } = useQuery<CountRow>(`
    SELECT COUNT(*) AS count FROM fvs_conclusoes WHERE fvs_planejada_id = ?
  `, [fvsId]);

  const { data: ncsAbertas } = useQuery<NcAbertaRow>(`
    SELECT nc.id as nc_id, nc.descricao, nc.numero_ocorrencia,
           nc.data_nova_verif, nc.responsavel_id,
           vi.fvs_padrao_item_id, vi.titulo,
           v.numero_verif, v.data_verif as nc_data_criacao
    FROM nao_conformidades nc
    JOIN verificacao_itens vi ON nc.verificacao_item_id = vi.id
    JOIN verificacoes v ON vi.verificacao_id = v.id
    WHERE v.fvs_planejada_id = ? AND nc.status IN ('aberta','em_correcao')
  `, [fvsId]);

  const { data: ultimaVerifItens } = useQuery<UltimaVerifItemRow>(`
    SELECT vi.fvs_padrao_item_id, vi.resultado
    FROM verificacao_itens vi
    JOIN verificacoes v ON vi.verificacao_id = v.id
    WHERE v.id = (
      SELECT id FROM verificacoes
      WHERE fvs_planejada_id = ?
      ORDER BY numero_verif DESC
      LIMIT 1
    )
  `, [fvsId]);

  const ncAbertoByItemId = useMemo(
    () => Object.fromEntries(ncsAbertas.map(r => [r.fvs_padrao_item_id, r])),
    [ncsAbertas],
  );

  const hasOpenNCs = Object.keys(ncAbertoByItemId).length > 0;

  const sortedItens = useMemo(() => {
    if (!hasOpenNCs) return itens;
    return [...itens].sort((a, b) => {
      const aHasNc = !!ncAbertoByItemId[a.id];
      const bHasNc = !!ncAbertoByItemId[b.id];
      if (aHasNc && !bHasNc) return -1;
      if (!aHasNc && bHasNc) return 1;
      return a.ordem - b.ordem;
    });
  }, [itens, ncAbertoByItemId, hasOpenNCs]);

  // Presentation-only state. Form data, validation and drafts live in
  // useVerificationFlow so native and PWA follow the same state machine.
  const [showEquipePicker, setShowEquipePicker] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reinspResult, setReinspResult] = useState<ReinspResult>({ type: 'idle' });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>('pending');
  const [userId, setUserId] = useState<string | null>(null);

  function showToast(msg: string, type: 'success' | 'error', onDone?: () => void) {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
      onDone?.();
    }, 2200);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    if (Platform.OS === 'web') {
      supabase.functions.invoke('r2-presign', {
        body: { filename: '_warmup.jpg', mimeType: 'image/jpeg' },
      }).catch(() => {});
    }
  }, []);

  const mode: VerificationMode = hasOpenNCs ? 'reinspection' : 'verification';
  const itemIds = useMemo(() => itens.map(item => item.id), [itens]);
  const openNcItemIds = useMemo(() => Object.keys(ncAbertoByItemId), [ncAbertoByItemId]);
  const itemFingerprint = useMemo(
    () => `${fvs?.revisao_associada ?? 0}:${itens.map(item => `${item.id}:${item.titulo}`).join('|')}`,
    [fvs?.revisao_associada, itens],
  );
  const draftContext = useMemo(() => {
    if (!userId || !fvs) return null;
    return {
      draftId: makeDraftId(userId, fvsId, mode),
      userId,
      obraId: id,
      ambienteId: ambId,
      fvsId,
      fvsName: fvs.subservico,
      ambienteName: ambienteNome,
      mode,
      revision: fvs.revisao_associada,
      itemFingerprint,
    };
  }, [ambId, ambienteNome, fvs, fvsId, id, itemFingerprint, mode, userId]);

  const flow = useVerificationFlow({
    context: draftContext,
    itemIds,
    openNcItemIds,
    isReinspection: hasOpenNCs,
  });
  const {
    state: {
      dataVerif,
      selectedEquipeId,
      itemResults,
      ncDetails,
      observacoes,
      signaturePath,
      reinspFoto,
      generalPhotos,
    },
    currentStep,
    steps: flowSteps,
    errors,
    draftCandidate,
    draftConflict,
    draftStatus,
    hasMeaningfulProgress,
    updateState,
    setItemResult,
    updateNc,
    getValidationErrors,
    validate: validateFlow,
    goToStep,
    nextStep,
    previousStep,
    stepForError,
    restoreDraft,
    discardDraft,
  } = flow;

  const {
    addFromCamera,
    addFromGallery,
    removePhoto,
  } = usePhotoCapture([], {
    photos: generalPhotos,
    onChange: photos => updateState({ generalPhotos: photos }),
  });

  const selectedEquipe = equipes.find(e => e.id === selectedEquipeId) ?? null;
  const algumNaoConforme = Object.values(itemResults).some(r => r === 'nao_conforme');
  const canConcludeCurrentFvs = canConcludeFvs(
    {
      dataVerif,
      selectedEquipeId,
      itemResults,
      ncDetails,
      observacoes,
      signaturePath,
      reinspFoto,
      generalPhotos,
    },
    itemIds,
    {
      isReinspection: hasOpenNCs,
      hasUnresolvedNc: hasOpenNCs,
    },
  );

  // Pré-preenche equipe da última verificação (editável pelo usuário).
  useEffect(() => {
    const equipeId = lastEquipeRows[0]?.equipe_id;
    if (equipeId && selectedEquipeId === null) {
      updateState({ selectedEquipeId: equipeId });
    }
  }, [lastEquipeRows, selectedEquipeId, updateState]);

  // Pré-preenche resultados da última verificação no modo de re-inspeção.
  useEffect(() => {
    if (!hasOpenNCs || !ultimaVerifItens.length) return;
    updateState(previous => {
      const nextResults = { ...previous.itemResults };
      for (const row of ultimaVerifItens) {
        if (nextResults[row.fvs_padrao_item_id] !== undefined) continue;
        const result = row.resultado as Resultado;
        if (result === 'conforme' || result === 'na') {
          nextResults[row.fvs_padrao_item_id] = result;
        }
      }
      return { ...previous, itemResults: nextResults };
    });
  }, [hasOpenNCs, ultimaVerifItens, updateState]);

  async function addNcPhoto(itemId: string) {
    const path = await captureNcPhoto();
    if (path) updateNc(itemId, { foto: path });
  }

  function validate(step?: VerificationStep): boolean {
    const errs = validateFlow(step);

    if (Object.keys(errs).length > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      Alert.alert(
        'Etapa incompleta',
        'Revise os campos indicados antes de continuar.',
      );
      return false;
    }
    return true;
  }

  function changeStep(targetStep: VerificationStep) {
    if (goToStep(targetStep)) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  function handleNextStep() {
    if (!validate(currentStep)) return;
    if (nextStep()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  function handlePreviousStep() {
    if (previousStep()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  async function handleSave(shouldConclude = false) {
    if (!validate()) return;
    if (shouldConclude && !canConcludeCurrentFvs) {
      Alert.alert(
        'Conclusão indisponível',
        'A FVS só pode ser concluída em uma verificação posterior, conforme e sem NC aberta.',
      );
      return;
    }
    setIsSaving(true);

    const verificationStatus = verificationStatusFromResults(itemIds, itemResults);

    const verificacaoId = uuid();
    const now = new Date().toISOString();
    let pendingResult: ReinspResult = { type: 'idle' };

    try {
      await db.execute(`
        INSERT INTO verificacoes
          (id, fvs_planejada_id, numero_verif, inspetor_id, equipe_id, data_verif,
           status, observacoes, created_offline, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        verificacaoId, fvsId, proximoNumero,
        userId ?? '', selectedEquipeId, dataVerif,
        verificationStatus, observacoes, 1, now,
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

        const ncAberta = ncAbertoByItemId[item.id];
        if (ncAberta) {
          const fotoUrl = reinspFoto ? `pending:${reinspFoto}` : null;
          if (resultado === 'conforme') {
            await approveReinspecao({ ncId: ncAberta.nc_id, verificacaoId, inspetorId: userId ?? '', fotoUrl });
            if (pendingResult.type === 'idle') {
              pendingResult = {
                type: 'aprovada',
                itemTitle: item.titulo,
                abertoEm: ncAberta.nc_data_criacao,
                resolvidoEm: now.slice(0, 10),
                responsavelNome: equipes.find(e => e.id === ncAberta.responsavel_id)?.nome ?? null,
                fotoUri: reinspFoto ?? null,
              };
            }
          } else if (resultado === 'nao_conforme') {
            const { proximaOcorrencia } = await reprovarReinspecao({
              ncId: ncAberta.nc_id,
              numeroOcorrenciaAtual: ncAberta.numero_ocorrencia,
              verificacaoId,
              inspetorId: userId ?? '',
              fotoUrl,
            });
            if (pendingResult.type === 'idle') {
              pendingResult = {
                type: 'reprovada',
                ocorrencia: proximaOcorrencia,
                ncAnteriorId: ncAberta.nc_id,
                ncAnteriorDescricao: ncAberta.descricao,
                ncAnteriorVerifNum: ncAberta.numero_verif,
                ncAnteriorDataCriacao: ncAberta.nc_data_criacao,
                verificacaoId,
                verificacaoItemId: itemVerifId,
              };
            }
          }
        } else if (resultado === 'nao_conforme') {
          const nc = ncDetails[item.id];
          if (nc) {
            await createNc({
              verificacaoId,
              verificacaoItemId: itemVerifId,
              descricao: nc.descricao,
              solucao_proposta: nc.solucao_proposta,
              responsavel_id: nc.responsavel_id || null,
              data_nova_verif: nc.data_nova_verif,
              foto_local_path: nc.foto,
            });
          }
        }
      }

      await Promise.all([
        ...generalPhotos.map((localPath, i) =>
          db.execute(`
            INSERT INTO verificacao_fotos
              (id, verificacao_id, r2_key, nome_arquivo, mime_type, ordem)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [uuid(), verificacaoId, `pending:${localPath}`, localPath.split('/').pop() ?? 'photo.jpg', 'image/jpeg', i])
        ),
        ...(signaturePath ? [db.execute(
          `UPDATE verificacoes SET assinatura_url = ?, assinada_em = ? WHERE id = ?`,
          [`pending:${signaturePath}`, now, verificacaoId]
        )] : []),
      ]);

      if (Platform.OS !== 'web' && !shouldConclude && fvs?.status !== 'em_revisao') {
        await db.execute(
          `UPDATE fvs_planejadas
           SET status = ?, concluida_em = ?
           WHERE id = ?`,
          ['em_andamento', null, fvsId],
        );
      }

      if (shouldConclude) {
        const conclusionNumber = (conclusionCountRows[0]?.count ?? 0) + 1;
        await db.execute(
          `INSERT INTO fvs_conclusoes
            (id, fvs_planejada_id, verificacao_id, inspetor_id, numero_conclusao,
             percentual_final, resultado, observacao_final, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(), fvsId, verificacaoId, userId ?? '', conclusionNumber,
            100, 'aprovado', observacoes || null, now,
          ],
        );

        if (Platform.OS !== 'web') {
          await db.execute(
            `UPDATE fvs_planejadas
             SET status = ?, concluida_em = ?, ultima_conclusao_em = ?
             WHERE id = ?`,
            ['concluida', now, now, fvsId],
          );
        }
      }

      if (draftContext) {
        try { await discardDraft(); } catch { /* saved record takes precedence */ }
      }

      if (pendingResult.type !== 'idle') {
        setReinspResult(pendingResult);
      } else {
        showToast(
          shouldConclude ? 'Verificação salva e FVS concluída!' : 'Verificação salva com sucesso!',
          'success',
          () => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`),
        );
      }
    } catch (err) {
      console.error('[NovaVerificacao] save error:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleConclude() {
    if (!validate()) return;
    Alert.alert(
      'Concluir esta FVS?',
      'A FVS será bloqueada. Para registrar outra verificação depois, será necessário reabri-la com justificativa.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salvar e concluir',
          onPress: () => { void handleSave(true); },
        },
      ],
    );
  }

  const inspectorInitials = usuario?.nome ? getInitials(usuario.nome) : 'IN';
  const answeredCount = itens.filter(item => itemResults[item.id]).length;
  const conformCount = Object.values(itemResults).filter(result => result === 'conforme').length;
  const ncCount = Object.values(itemResults).filter(result => result === 'nao_conforme').length;
  const naCount = Object.values(itemResults).filter(result => result === 'na').length;
  const filteredChecklistItems = sortedItens.filter(item => {
    if (checklistFilter === 'pending') {
      return !itemResults[item.id] || !!ncAbertoByItemId[item.id];
    }
    if (checklistFilter === 'nc') {
      return itemResults[item.id] === 'nao_conforme' || !!ncAbertoByItemId[item.id];
    }
    return true;
  });
  const reviewErrors = getValidationErrors();
  const draftHelper = {
    idle: hasMeaningfulProgress ? 'Rascunho local ativo' : 'O rascunho começa ao preencher',
    saving: 'Salvando rascunho…',
    saved: 'Rascunho salvo neste dispositivo',
    error: 'Não foi possível atualizar o rascunho',
  }[draftStatus];

  // Guard: FVS concluída bloqueia nova verificação (RN-FVS-01)
  if (fvs && (fvs.status === 'conforme' || fvs.status === 'concluida' || fvs.status === 'concluida_ressalva')) {
    return (
      <SafeAreaView style={st.safe}>
        <AppHeader
          title="Nova Verificação"
          subtitle={[ambienteNome, fvs.subservico].filter(Boolean).join(' · ')}
          showBack
          onBack={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
        />
        <View style={st.lockedScreen}>
          <View style={st.lockedIcon}>
            <LockKeyhole size={28} color={Colors.brand} />
          </View>
          <Text style={st.lockedTitle}>
            Verificação bloqueada
          </Text>
          <Text style={st.lockedDescription}>
            Este serviço está concluído.{'\n'}Para registrar uma nova verificação, solicite a reabertura no histórico da FVS.
          </Text>
          <Button
            label="Voltar ao histórico"
            Icon={ArrowLeft}
            onPress={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      <AppHeader
        title={hasOpenNCs ? 'Reinspeção de serviço' : 'Nova verificação'}
        subtitle={[
          ambienteNome,
          hasOpenNCs ? `Reinspeção #${proximoNumero}` : `Verificação #${proximoNumero}`,
          fvs?.subservico,
        ].filter(Boolean).join(' · ')}
        showBack
        onBack={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
      />

      <Stepper steps={flowSteps} current={currentStep} />

      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.flowContent}
        >
          {draftCandidate ? (
            <Card tone={draftConflict ? 'danger' : 'accent'} style={st.draftBanner}>
              <View style={st.draftBannerHeader}>
                {draftConflict
                  ? <AlertCircle size={22} color={Colors.nok} />
                  : <Save size={22} color={Colors.brand} />
                }
                <View style={st.draftBannerCopy}>
                  <Text style={st.draftBannerTitle}>
                    {draftConflict ? 'Rascunho incompatível' : 'Rascunho encontrado'}
                  </Text>
                  <Text style={st.draftBannerText}>
                    {draftConflict
                      ? 'A revisão ou os itens desta FVS mudaram. Descarte o rascunho antigo para continuar com segurança.'
                      : `Última atualização em ${new Date(draftCandidate.updatedAt).toLocaleString('pt-BR')}.`
                    }
                  </Text>
                </View>
              </View>
              <View style={st.draftBannerActions}>
                <Button label="Descartar" onPress={() => { void discardDraft(); }} variant="ghost" />
                {!draftConflict ? <Button label="Continuar rascunho" onPress={restoreDraft} /> : null}
              </View>
            </Card>
          ) : null}

          <View style={[st.flowColumns, isTablet && st.flowColumnsTablet]}>
            <View style={st.flowMain}>
              {currentStep === 'context' ? (
                <>
                  <SectionTitle
                    eyebrow="ETAPA 1 DE 4"
                    title="Contexto do serviço"
                    description="Confirme quem está executando o serviço e o avanço encontrado em campo."
                  />

                  {hasOpenNCs ? (
                    <NCReinspectionBanner
                      itemTitle={ncsAbertas[0]?.titulo ?? ''}
                      ncId={ncsAbertas[0]?.nc_id ?? ''}
                    />
                  ) : null}

                  <Card style={st.inspectorCard}>
                    <View style={st.inspectorAvatar}>
                      <Text style={st.inspectorAvatarText}>{inspectorInitials}</Text>
                    </View>
                    <View style={st.flex}>
                      <Text style={st.inspectorName}>{usuario?.nome ?? 'Inspetor'}</Text>
                      <Text style={st.inspectorRole}>{usuario?.cargo ?? 'Inspetor de Campo'}</Text>
                    </View>
                    <Chip label="Inspetor logado" selected />
                  </Card>

                  <Card style={st.formCard}>
                    <View style={st.section}>
                      <Text style={st.sectionTitle}>Data da verificação</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          aria-label="Data da verificação"
                          type="date"
                          value={dataVerif}
                          onChange={(event: { target: { value: string } }) => updateState({ dataVerif: event.target.value })}
                          style={{
                            backgroundColor: Colors.surface,
                            borderRadius: Radius.md,
                            border: `1px solid ${Colors.borderNormal}`,
                            minHeight: 48,
                            padding: '10px 12px',
                            fontSize: FontSizes.md,
                            color: Colors.text,
                            width: '100%',
                            boxSizing: 'border-box',
                            outline: 'none',
                            fontFamily: FontFamily.regular,
                          }}
                        />
                      ) : (
                        <TextInput
                          accessibilityLabel="Data da verificação"
                          style={st.input}
                          value={dataVerif}
                          onChangeText={value => updateState({ dataVerif: value })}
                          placeholder="AAAA-MM-DD"
                          placeholderTextColor={Colors.textTertiary}
                          keyboardType="numbers-and-punctuation"
                          maxLength={10}
                        />
                      )}
                    </View>

                    <View style={st.section}>
                      <Text style={st.sectionTitle}>Equipe executora</Text>
                      {errors.equipe ? <Text style={st.errorText}>{errors.equipe}</Text> : null}
                      <Modal visible={showEquipePicker} transparent animationType="fade">
                        <Pressable style={ncSt.overlay} onPress={() => setShowEquipePicker(false)}>
                          <View style={ncSt.pickerBox}>
                            <Text style={ncSt.pickerTitle}>Equipe executora</Text>
                            <ScrollView>
                              {equipes.map(team => (
                                <Pressable
                                  accessibilityRole="radio"
                                  accessibilityState={{ checked: selectedEquipeId === team.id }}
                                  key={team.id}
                                  style={[ncSt.pickerItem, selectedEquipeId === team.id && ncSt.pickerItemActive]}
                                  onPress={() => {
                                    updateState({ selectedEquipeId: team.id });
                                    setShowEquipePicker(false);
                                  }}
                                >
                                  <Text style={[ncSt.pickerItemText, selectedEquipeId === team.id && ncSt.pickerItemTextActive]}>
                                    {team.nome}
                                  </Text>
                                  <Text style={st.equipePickerTipo}>{team.tipo}</Text>
                                </Pressable>
                              ))}
                            </ScrollView>
                          </View>
                        </Pressable>
                      </Modal>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Selecionar equipe executora"
                        style={[st.teamSelectBtn, errors.equipe && st.inputError]}
                        onPress={() => setShowEquipePicker(true)}
                      >
                        <View style={st.flex}>
                          <Text style={st.teamSelectLabel}>Responsável técnico e equipe</Text>
                          <Text style={st.teamSelectBtnText} numberOfLines={1}>
                            {selectedEquipe ? selectedEquipe.nome : 'Selecionar equipe'}
                          </Text>
                        </View>
                        <ChevronDown size={18} color={Colors.textSecondary} />
                      </Pressable>
                      {selectedEquipe ? (
                        <View style={st.teamSelected}>
                          <View style={st.teamAvatar}>
                            <Text style={st.teamAvatarText}>{getInitials(selectedEquipe.nome)}</Text>
                          </View>
                          <View style={st.flex}>
                            <Text style={st.teamName}>{selectedEquipe.nome}</Text>
                            <Text style={st.teamType}>{selectedEquipe.tipo ?? 'Equipe própria'}</Text>
                          </View>
                          <CheckCircle2 size={18} color={Colors.ok} />
                        </View>
                      ) : null}
                    </View>

                  </Card>
                </>
              ) : null}

              {currentStep === 'checklist' ? (
                <>
                  <SectionTitle
                    eyebrow="ETAPA 2 DE 4"
                    title="Checklist de qualidade"
                    description={`${answeredCount} de ${itens.length} itens classificados.`}
                  />
                  <View style={st.progressSummary}>
                    <View style={st.progressSummaryBar}>
                      <View
                        style={[
                          st.progressSummaryFill,
                          { width: `${itens.length ? (answeredCount / itens.length) * 100 : 0}%` as `${number}%` },
                        ]}
                      />
                    </View>
                    <Text style={st.progressSummaryText}>
                      {itens.length ? Math.round((answeredCount / itens.length) * 100) : 0}%
                    </Text>
                  </View>
                  <SegmentedControl
                    accessibilityLabel="Filtro do checklist"
                    value={checklistFilter}
                    onChange={setChecklistFilter}
                    options={[
                      { value: 'pending', label: `Pendentes (${itens.length - answeredCount})`, Icon: Circle },
                      { value: 'all', label: `Todos (${itens.length})`, Icon: ClipboardCheck },
                      { value: 'nc', label: `NC (${ncCount})`, Icon: AlertCircle },
                    ]}
                  />

                  {filteredChecklistItems.length === 0 ? (
                    <Card tone="success" style={st.completedCard}>
                      <CheckCircle2 size={26} color={Colors.ok} />
                      <View style={st.flex}>
                        <Text style={st.completedTitle}>Todos os itens foram classificados</Text>
                        <Text style={st.completedText}>Revise em “Todos” ou avance para as evidências.</Text>
                      </View>
                      <Button label="Ver todos" onPress={() => setChecklistFilter('all')} variant="ghost" />
                    </Card>
                  ) : null}

                  {filteredChecklistItems.map(item => {
                    const result = itemResults[item.id];
                    const isNok = result === 'nao_conforme';
                    const openNc = ncAbertoByItemId[item.id];
                    const isNcItem = !!openNc;
                    const isLocked = hasOpenNCs && !isNcItem;
                    return (
                      <Card
                        key={item.id}
                        style={[
                          st.checklistCard,
                          isNok && st.checklistCardNok,
                          isNcItem && !isNok && st.checklistCardOpenNc,
                        ]}
                      >
                        <View style={st.checklistHeader}>
                          <View style={[st.itemNum, (isNok || isNcItem) && st.itemNumNok]}>
                            <Text style={[st.itemNumText, (isNok || isNcItem) && st.itemNumTextNok]}>
                              {item.ordem}
                            </Text>
                          </View>
                          <View style={st.flex}>
                            <Text style={st.itemTitulo}>{item.titulo}</Text>
                            {isNcItem ? <Text style={st.openNcLabel}>NC aberta · avaliar agora</Text> : null}
                          </View>
                          {result ? (
                            <Chip
                              label={result === 'conforme' ? 'Conforme' : result === 'nao_conforme' ? 'NC' : 'N/A'}
                              selected
                            />
                          ) : null}
                        </View>

                        {(item.metodo_verif || item.tolerancia) ? (
                          <View style={st.itemMethod}>
                            {item.metodo_verif ? (
                              <View style={st.flex}>
                                <Text style={st.itemMethodLabel}>MÉTODO</Text>
                                <Text style={st.itemMethodText}>{item.metodo_verif}</Text>
                              </View>
                            ) : null}
                            {item.tolerancia ? (
                              <View style={st.toleranciaBadge}>
                                <Text style={st.toleranciaLabel}>TOLERÂNCIA</Text>
                                <Text style={st.toleranciaText}>{item.tolerancia}</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}

                        <View style={st.itemActions}>
                          {errors[`item_${item.id}`] ? (
                            <Text style={st.errorText}>{errors[`item_${item.id}`]}</Text>
                          ) : null}
                          <View style={[st.resultRow, isLocked && st.locked]} pointerEvents={isLocked ? 'none' : 'auto'}>
                            {([
                              { key: 'conforme' as Resultado, label: 'Conforme', Icon: Check },
                              { key: 'nao_conforme' as Resultado, label: 'Não conforme', Icon: X },
                              { key: 'na' as Resultado, label: 'N/A', Icon: Minus },
                            ]).map(option => {
                              const active = result === option.key;
                              const ResultIcon = option.Icon;
                              const activeStyle = active ? resultBtnActive(option.key) : undefined;
                              return (
                                <Pressable
                                  accessibilityRole="radio"
                                  accessibilityState={{ checked: active, disabled: isLocked }}
                                  key={option.key}
                                  style={({ pressed }) => [
                                    st.resultBtn,
                                    activeStyle,
                                    pressed && !active && st.resultBtnPressed,
                                  ]}
                                  onPress={() => setItemResult(item.id, option.key)}
                                >
                                  <ResultIcon size={16} color={active ? Colors.surface : Colors.textSecondary} />
                                  <Text style={[st.resultBtnText, active && resultBtnTextActive()]}>
                                    {option.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          {isNok && !isNcItem ? (
                            <NcPanel
                              visible
                              detail={ncDetails[item.id] ?? {
                                descricao: '',
                                solucao_proposta: '',
                                data_nova_verif: '',
                                responsavel_id: '',
                                foto: null,
                              }}
                              onChange={patch => updateNc(item.id, patch)}
                              onAddPhoto={() => addNcPhoto(item.id)}
                              equipes={equipes}
                              responsibleError={errors[`nc_resp_${item.id}`]}
                            />
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </>
              ) : null}

              {currentStep === 'evidence' ? (
                <>
                  <SectionTitle
                    eyebrow="ETAPA 3 DE 4"
                    title="Evidências e resultado"
                    description="Registre o que sustenta sua decisão antes da assinatura."
                  />
                  <Card style={st.formCard}>
                    {hasOpenNCs ? (
                      <View style={st.section}>
                        <Text style={st.sectionTitle}>Foto da reinspeção *</Text>
                        <Text style={st.fieldHint}>Mostre claramente a condição atual do item corrigido.</Text>
                        {errors.reinspFoto ? <Text style={st.errorText}>{errors.reinspFoto}</Text> : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={reinspFoto ? 'Substituir foto da reinspeção' : 'Adicionar foto da reinspeção'}
                          style={[
                            st.reinspPhotoBtn,
                            reinspFoto && st.reinspPhotoFilled,
                            errors.reinspFoto && st.inputError,
                          ]}
                          onPress={async () => {
                            const path = await captureNcPhoto();
                            if (path) updateState({ reinspFoto: path });
                          }}
                        >
                          {reinspFoto ? (
                            <Image source={{ uri: reinspFoto }} style={st.reinspPhotoThumb} resizeMode="cover" />
                          ) : (
                            <View style={st.photoPlaceholder}>
                              <Camera size={24} color={Colors.brand} />
                              <Text style={st.reinspPhotoBtnText}>Adicionar foto obrigatória</Text>
                            </View>
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      <View style={st.section}>
                        <View style={st.labelRow}>
                          <View>
                            <Text style={st.sectionTitle}>Fotos de evidência</Text>
                            <Text style={st.fieldHint}>Até 10 imagens do serviço executado.</Text>
                          </View>
                          <Text style={st.photoCount}>{generalPhotos.length}/10</Text>
                        </View>
                        <View style={st.photoBtns}>
                          <Button label="Usar câmera" onPress={() => { void addFromCamera(); }} Icon={Camera} variant="secondary" />
                          <Button label="Galeria" onPress={() => { void addFromGallery(); }} Icon={ImageIcon} variant="secondary" />
                        </View>
                        {generalPhotos.length > 0 ? (
                          <PhotoGrid photos={generalPhotos} max={10} onRemove={removePhoto} />
                        ) : null}
                      </View>
                    )}

                    <View style={st.sectionDivider} />

                    <View style={st.section}>
                      <Text style={st.sectionTitle}>Observações gerais</Text>
                      <TextInput
                        accessibilityLabel="Observações gerais"
                        style={[st.input, st.observationsInput]}
                        multiline
                        placeholder="Ocorrências, condições do ambiente e informações úteis…"
                        placeholderTextColor={Colors.textTertiary}
                        value={observacoes}
                        onChangeText={value => updateState({ observacoes: value })}
                        textAlignVertical="top"
                      />
                    </View>

                    <View style={st.sectionDivider} />
                    <View style={st.section}>
                      <Text style={st.sectionTitle}>Resultado desta verificação</Text>
                      <View style={[
                        st.resultSummary,
                        algumNaoConforme ? st.resultSummaryDanger : st.resultSummarySuccess,
                      ]}>
                        {algumNaoConforme
                          ? <X size={20} color={Colors.nok} />
                          : <CheckCircle2 size={20} color={Colors.ok} />
                        }
                        <View style={st.flex}>
                          <Text style={[
                            st.resultSummaryTitle,
                            { color: algumNaoConforme ? Colors.nok : Colors.ok },
                          ]}>
                            {algumNaoConforme ? 'Não conforme' : 'Conforme'}
                          </Text>
                          <Text style={st.resultSummaryText}>
                            Resultado calculado automaticamente a partir dos itens do checklist.
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                </>
              ) : null}

              {currentStep === 'review' ? (
                <>
                  <SectionTitle
                    eyebrow="ETAPA 4 DE 4"
                    title="Revisão e assinatura"
                    description="Confira o resumo. O registro será salvo localmente e sincronizado quando houver conexão."
                  />

                  <View style={st.reviewMetrics}>
                    <ReviewMetric label="Conformes" value={conformCount} color={Colors.ok} background={Colors.okBg} />
                    <ReviewMetric label="Não conformes" value={ncCount} color={Colors.nok} background={Colors.nokBg} />
                    <ReviewMetric label="N/A" value={naCount} color={Colors.textSecondary} background={Colors.surface2} />
                  </View>

                  <Card style={st.reviewCard}>
                    <Text style={st.reviewCardTitle}>Resumo do registro</Text>
                    <ReviewRow label="Serviço" value={fvs?.subservico ?? '—'} />
                    <ReviewRow label="Ambiente" value={ambienteNome || '—'} />
                    <ReviewRow label="Equipe" value={selectedEquipe?.nome ?? 'Não selecionada'} />
                    <ReviewRow
                      label="Resultado"
                      value={algumNaoConforme ? 'Não conforme' : 'Conforme'}
                    />
                    <ReviewRow
                      label="Evidências"
                      value={`${generalPhotos.length + (reinspFoto ? 1 : 0)} foto${generalPhotos.length + (reinspFoto ? 1 : 0) === 1 ? '' : 's'}`}
                    />
                  </Card>

                  {Object.keys(reviewErrors).length > 0 ? (
                    <View style={st.section}>
                      <ErrorBanner message="Existem informações obrigatórias pendentes antes do salvamento." />
                      <Card style={st.issueCard}>
                        {Object.entries(reviewErrors).map(([key, message], index, entries) => (
                          <Pressable
                            accessibilityRole="button"
                            key={key}
                            onPress={() => changeStep(stepForError(key))}
                            style={[
                              st.issueRow,
                              index < entries.length - 1 && st.issueRowBorder,
                            ]}
                          >
                            <AlertCircle size={18} color={Colors.nok} />
                            <Text style={st.issueText}>{message}</Text>
                            <Text style={st.issueAction}>Corrigir</Text>
                          </Pressable>
                        ))}
                      </Card>
                    </View>
                  ) : (
                    <Card tone="success" style={st.readyCard}>
                      <CheckCircle2 size={23} color={Colors.ok} />
                      <View style={st.flex}>
                        <Text style={st.readyTitle}>Preenchimento completo</Text>
                        <Text style={st.readyText}>Revise e registre a assinatura para finalizar.</Text>
                      </View>
                    </Card>
                  )}

                  <Card style={st.formCard}>
                    <View style={st.section}>
                      <Text style={st.sectionTitle}>Assinatura digital *</Text>
                      <Text style={st.signatureResponsavel}>
                        Responsável: <Text style={st.signatureName}>{usuario?.nome ?? '—'}</Text>
                      </Text>
                      {errors.assinatura ? <Text style={st.errorText}>{errors.assinatura}</Text> : null}
                      {signaturePath ? (
                        <View style={st.signedConfirm}>
                          <CheckCircle2 size={18} color={Colors.ok} />
                          <Text style={st.signedText}>Assinatura registrada</Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              updateState({ signaturePath: null });
                              if (Platform.OS !== 'web') setShowSignature(true);
                            }}
                          >
                            <Text style={st.refazerText}>Refazer</Text>
                          </Pressable>
                        </View>
                      ) : Platform.OS === 'web' ? (
                        <SignatureField
                          visible
                          inline
                          onSign={path => updateState({ signaturePath: path })}
                          onCancel={() => {}}
                        />
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Abrir área de assinatura"
                          style={[st.signatureArea, errors.assinatura && st.inputError]}
                          onPress={() => setShowSignature(true)}
                        >
                          <PenLine size={24} color={errors.assinatura ? Colors.nok : Colors.brand} />
                          <Text style={[st.signatureHint, errors.assinatura && { color: Colors.nok }]}>
                            Toque para assinar
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </Card>

                  {canConcludeCurrentFvs ? (
                    <Card tone="accent" style={st.conclusionChoice}>
                      <View style={st.conclusionChoiceCopy}>
                        <Text style={st.conclusionChoiceTitle}>O acompanhamento termina aqui?</Text>
                        <Text style={st.conclusionChoiceText}>
                          Salve normalmente para continuar verificando este serviço em outros dias.
                          Conclua somente quando não houver mais inspeções previstas.
                        </Text>
                      </View>
                      <Button
                        label="Salvar e concluir FVS"
                        Icon={LockKeyhole}
                        variant="secondary"
                        onPress={handleConclude}
                        disabled={isSaving || !!toast || !!draftCandidate}
                        fullWidth
                      />
                    </Card>
                  ) : null}
                </>
              ) : null}
            </View>

            {isTablet ? (
              <View style={st.summaryRail}>
                <Card style={st.summaryCard}>
                  <Text style={st.summaryEyebrow}>PROGRESSO</Text>
                  <Text style={st.summaryTitle}>{answeredCount}/{itens.length} itens</Text>
                  <View style={st.progressSummaryBar}>
                    <View
                      style={[
                        st.progressSummaryFill,
                        { width: `${itens.length ? (answeredCount / itens.length) * 100 : 0}%` as `${number}%` },
                      ]}
                    />
                  </View>
                  <View style={st.summaryDivider} />
                  <SummaryItem label="Equipe" value={selectedEquipe?.nome ?? 'Pendente'} />
                  <SummaryItem label="Resultado" value={algumNaoConforme ? 'Não conforme' : 'Conforme'} />
                  <SummaryItem label="NCs" value={`${ncCount}`} />
                  <View style={st.summaryDivider} />
                  <Text style={[st.draftStatus, draftStatus === 'error' && st.draftStatusError]}>
                    {draftHelper}
                  </Text>
                </Card>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomActionBar
        primaryLabel={
          currentStep === 'review'
            ? (hasOpenNCs ? 'Salvar reinspeção' : 'Salvar e continuar acompanhando')
            : 'Continuar'
        }
        onPrimary={
          currentStep === 'review'
            ? () => { void handleSave(false); }
            : handleNextStep
        }
        primaryLoading={currentStep === 'review' && isSaving}
        primaryDisabled={!!toast || !!draftCandidate}
        secondaryLabel={currentStep !== 'context' ? 'Voltar' : undefined}
        onSecondary={currentStep !== 'context' ? handlePreviousStep : undefined}
        helper={!isTablet ? draftHelper : undefined}
      />

      {/* Modal de assinatura — apenas nativo */}
      {Platform.OS !== 'web' && (
        <SignatureField
          visible={showSignature}
          onSign={path => {
            updateState({ signaturePath: path });
            setShowSignature(false);
          }}
          onCancel={() => setShowSignature(false)}
        />
      )}

      {/* Re-inspeção aprovada */}
      <NCResolvedScreen
        visible={reinspResult.type === 'aprovada'}
        itemTitle={reinspResult.type === 'aprovada' ? reinspResult.itemTitle : ''}
        abertoEm={reinspResult.type === 'aprovada' ? reinspResult.abertoEm : null}
        resolvidoEm={reinspResult.type === 'aprovada' ? reinspResult.resolvidoEm : ''}
        responsavelNome={reinspResult.type === 'aprovada' ? reinspResult.responsavelNome : null}
        fotoUri={reinspResult.type === 'aprovada' ? reinspResult.fotoUri : null}
        onConcluir={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
      />

      {/* Re-inspeção reprovada */}
      <NCReprovadaPanel
        visible={reinspResult.type === 'reprovada'}
        ocorrencia={reinspResult.type === 'reprovada' ? reinspResult.ocorrencia : 0}
        ncAnteriorId={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorId : ''}
        ncAnteriorDescricao={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorDescricao : ''}
        ncAnteriorVerifNum={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorVerifNum : 0}
        ncAnteriorDataCriacao={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorDataCriacao : ''}
        verificacaoId={reinspResult.type === 'reprovada' ? reinspResult.verificacaoId : ''}
        verificacaoItemId={reinspResult.type === 'reprovada' ? reinspResult.verificacaoItemId : ''}
        equipes={equipes}
        onSalvo={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
      />

      {/* Toast feedback */}
      {toast && (
        <View style={[st.toast, toast.type === 'success' ? st.toastSuccess : st.toastError]}>
          <Text style={st.toastText}>{toast.msg}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function ReviewMetric({
  label,
  value,
  color,
  background,
}: {
  label: string;
  value: number;
  color: string;
  background: string;
}) {
  return (
    <View style={[st.reviewMetric, { backgroundColor: background }]}>
      <Text style={[st.reviewMetricValue, { color }]}>{value}</Text>
      <Text style={st.reviewMetricLabel}>{label}</Text>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.reviewRow}>
      <Text style={st.reviewLabel}>{label}</Text>
      <Text style={st.reviewValue}>{value}</Text>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.summaryItem}>
      <Text style={st.summaryItemLabel}>{label}</Text>
      <Text style={st.summaryItemValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function resultBtnActive(r: Resultado): object {
  if (r === 'conforme')     return { backgroundColor: Colors.ok,       borderColor: Colors.ok };
  if (r === 'nao_conforme') return { backgroundColor: Colors.nok,      borderColor: Colors.nok };
  return                           { backgroundColor: Colors.na,       borderColor: Colors.na };
}
function resultBtnTextActive(): object {
  return { color: Colors.surface };
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  lockedScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  lockedIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    backgroundColor: Colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { ...Typography.heading, color: Colors.text, textAlign: 'center' },
  lockedDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 460,
  },
  flowContent: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  flowColumns: { width: '100%', gap: Spacing.xxl },
  flowColumnsTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  flowMain: { flex: 1, maxWidth: Breakpoints.maxForm, gap: Spacing.xl },
  formCard: { gap: Spacing.xl },
  draftBanner: { gap: Spacing.md },
  draftBannerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  draftBannerCopy: { flex: 1, gap: 3 },
  draftBannerTitle: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  draftBannerText: { ...Typography.caption, color: Colors.textSecondary },
  draftBannerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  inputError: { borderColor: Colors.nok, borderWidth: 1.5 },
  fieldHint: { ...Typography.caption, color: Colors.textSecondary },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  progressSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  progressSummaryBar: {
    flex: 1,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface2,
    overflow: 'hidden',
  },
  progressSummaryFill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.brand },
  progressSummaryText: {
    minWidth: 40,
    textAlign: 'right',
    ...Typography.label,
    color: Colors.textSecondary,
  },
  completedCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  completedTitle: { ...Typography.bodyMedium, color: Colors.ok, fontFamily: FontFamily.semibold },
  completedText: { ...Typography.caption, color: Colors.textSecondary },
  checklistCard: { padding: 0, overflow: 'hidden' },
  checklistCardNok: { borderColor: Colors.nok, borderWidth: 1.5 },
  checklistCardOpenNc: { borderColor: Colors.nok, borderWidth: 1.5 },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  openNcLabel: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold, marginTop: 3 },
  locked: { opacity: 0.45 },
  resultBtnPressed: { backgroundColor: Colors.border },
  sectionDivider: { height: 1, backgroundColor: Colors.border },
  observationsInput: { minHeight: 120, textAlignVertical: 'top' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  reinspPhotoFilled: { borderStyle: 'solid', borderColor: Colors.border },
  reviewMetrics: { flexDirection: 'row', gap: Spacing.sm },
  reviewMetric: { flex: 1, borderRadius: Radius.lg, padding: Spacing.md, minHeight: 96 },
  reviewMetricValue: { fontFamily: FontFamily.bold, fontSize: FontSizes.xxl, lineHeight: 32 },
  reviewMetricLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },
  reviewCard: { gap: 0 },
  reviewCardTitle: {
    ...Typography.bodyMedium,
    color: Colors.text,
    fontFamily: FontFamily.semibold,
    marginBottom: Spacing.sm,
  },
  reviewRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reviewLabel: { ...Typography.caption, color: Colors.textSecondary },
  reviewValue: { ...Typography.caption, color: Colors.text, fontFamily: FontFamily.semibold, flex: 1, textAlign: 'right' },
  issueCard: { padding: 0, overflow: 'hidden' },
  issueRow: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  issueRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  issueText: { ...Typography.caption, color: Colors.text, flex: 1 },
  issueAction: { ...Typography.label, color: Colors.brand },
  readyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  readyTitle: { ...Typography.bodyMedium, color: Colors.ok, fontFamily: FontFamily.semibold },
  readyText: { ...Typography.caption, color: Colors.textSecondary },
  signatureName: { color: Colors.text, fontFamily: FontFamily.semibold },
  summaryRail: { width: 310 },
  summaryCard: { gap: Spacing.md },
  summaryEyebrow: {
    ...Typography.caption,
    color: Colors.brand,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.9,
  },
  summaryTitle: { ...Typography.heading, color: Colors.text },
  summaryDivider: { height: 1, backgroundColor: Colors.border },
  summaryItem: { gap: 2 },
  summaryItemLabel: { ...Typography.caption, color: Colors.textTertiary },
  summaryItemValue: { ...Typography.bodyMedium, color: Colors.text },
  draftStatus: { ...Typography.caption, color: Colors.ok, fontFamily: FontFamily.medium },
  draftStatusError: { color: Colors.nok },
  teamType: { ...Typography.caption, color: Colors.textSecondary },
  safe:    { flex: 1, backgroundColor: Colors.bg },
  toast: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 12, zIndex: 999,
    shadowColor: Colors.text, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
  },
  toastSuccess: { backgroundColor: Colors.ok },
  toastError:   { backgroundColor: Colors.nok },
  toastText:    { color: Colors.surface, fontSize: FontSizes.md, fontWeight: '500', textAlign: 'center' },
  content:    { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Colors.text },

  // Inspector card
  inspectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  inspectorAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandLight,
    borderWidth: 1,
    borderColor: Colors.brandSignature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectorAvatarText: { color: Colors.brand, fontSize: FontSizes.base, fontFamily: FontFamily.bold },
  inspectorName: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  inspectorRole: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  logadoBadge: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 0.5, borderColor: Colors.borderNormal,
  },
  logadoText: { fontSize: FontSizes.tiny, color: Colors.textSecondary, fontWeight: '500' },

  // Input
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.md,
    color: Colors.text,
  },

  // Equipe
  teamCard: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  teamSelect: { padding: Spacing.md, gap: 6 },
  teamSelectLabel: { ...Typography.caption, color: Colors.textSecondary },
  teamSelectBtn: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  teamSelectBtnText: { ...Typography.bodyMedium, color: Colors.text },
  teamDivider: { height: 0.5, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: Spacing.md },
  teamSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.okBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ok,
  },
  teamAvatar: {
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.ok,
    alignItems: 'center', justifyContent: 'center',
  },
  teamAvatarText: { color: Colors.surface, fontSize: FontSizes.xs, fontFamily: FontFamily.bold },
  teamName: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  tipoBadge:       { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tipoBadgeGreen:  { backgroundColor: Colors.okBg },
  tipoBadgeBlue:   { backgroundColor: Colors.progressBg },
  tipoBadgeText:       { fontSize: FontSizes.tiny, fontWeight: '500' },
  tipoBadgeTextGreen:  { color: Colors.ok },
  tipoBadgeTextBlue:   { color: Colors.progress },
  equipePickerTipo: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },

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
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemNumNok: { backgroundColor: Colors.nokBg, borderWidth: 1, borderColor: Colors.nok },
  itemNumText: { fontSize: FontSizes.xs, fontFamily: FontFamily.semibold, color: Colors.textSecondary },
  itemNumTextNok: { color: Colors.nok },
  itemTitulo: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },

  itemMethod: {
    backgroundColor: Colors.surface2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  itemMethodLabel: { fontSize: FontSizes.tiny, fontFamily: FontFamily.semibold, color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 3 },
  itemMethodText: { ...Typography.caption, color: Colors.textSecondary },

  toleranciaBadge: { alignItems: 'flex-end' },
  toleranciaLabel: { fontSize: FontSizes.tiny, fontFamily: FontFamily.semibold, color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 3 },
  toleranciaText: { ...Typography.caption, fontFamily: FontFamily.semibold, color: Colors.progress },

  itemActions: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  resultRow: { flexDirection: 'row', gap: Spacing.sm },
  resultBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
  },
  resultBtnText: { fontSize: FontSizes.xs, fontFamily: FontFamily.medium, color: Colors.textSecondary, textAlign: 'center' },

  // Photos
  photoBtns:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  photoActionText: { fontSize: FontSizes.base, color: Colors.progress, fontWeight: '500' },
  photoCount: { ...Typography.label, color: Colors.textSecondary, marginLeft: 'auto' },

  resultSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  resultSummarySuccess: { backgroundColor: Colors.okBg, borderColor: Colors.ok },
  resultSummaryDanger: { backgroundColor: Colors.nokBg, borderColor: Colors.nok },
  resultSummaryTitle: { ...Typography.label, fontFamily: FontFamily.semibold },
  resultSummaryText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  conclusionChoice: { gap: Spacing.md },
  conclusionChoiceCopy: { gap: 4 },
  conclusionChoiceTitle: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  conclusionChoiceText: { ...Typography.caption, color: Colors.textSecondary },

  // Assinatura
  signatureResponsavel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  signedConfirm: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.okBg,
    borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.ok,
    padding: Spacing.md, gap: Spacing.sm,
  },
  signedText: { flex: 1, ...Typography.caption, color: Colors.ok, fontFamily: FontFamily.semibold },
  refazerText: { ...Typography.label, color: Colors.brand },
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
  signatureHint: { ...Typography.label, color: Colors.brand },

  // Save bar
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn:         { backgroundColor: Colors.brand, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: Colors.surface, fontSize: FontSizes.md, fontWeight: '600' },

  errorText: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },

  // Re-inspeção
  reinspSectionHeader: { fontSize: 10, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  itemWrapperReinsp:   { borderColor: Colors.nok, borderWidth: 1.5 },
  itemHeaderReinsp:    { backgroundColor: Colors.nokBg },
  itemNumReinsp:       { backgroundColor: Colors.nokBg, borderWidth: 0.5, borderColor: Colors.nok },
  itemNumTextReinsp:   { color: Colors.nok },
  ncAbertaBadge:       { backgroundColor: Colors.nok, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  ncAbertaBadgeText:   { fontSize: 9, color: Colors.surface, fontWeight: '700' },
  reinspPhotoBtn: {
    height: 180,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.brandSignature,
    borderStyle: 'dashed',
    backgroundColor: Colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reinspPhotoBtnText: { ...Typography.label, color: Colors.brand },
  reinspPhotoThumb: { width: '100%', height: '100%' },

});
