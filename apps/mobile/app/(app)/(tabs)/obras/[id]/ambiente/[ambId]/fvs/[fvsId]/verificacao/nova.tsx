import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '../../../../../../../../../../lib/navigation';
import {
  Camera,
  ChevronDown,
  Image as ImageIcon,
  PenLine,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { AppHeader } from '../../../../../../../../../../components/AppHeader';
import { NCReinspectionBanner } from '../../../../../../../../../../components/NCReinspectionBanner';
import { NCReprovadaPanel } from '../../../../../../../../../../components/NCReprovadaPanel';
import { NCResolvedScreen } from '../../../../../../../../../../components/NCResolvedScreen';
import { PhotoGrid } from '../../../../../../../../../../components/PhotoGrid';
import { SignatureField } from '../../../../../../../../../../components/SignatureField';
import { captureNcPhoto } from '../../../../../../../../../../hooks/useNcPhoto';
import { usePhotoCapture } from '../../../../../../../../../../hooks/usePhotoCapture';
import { Colors, FontSizes, Radius, Spacing } from '../../../../../../../../../../lib/constants';
import { db } from '../../../../../../../../../../lib/powersync';
import { supabase } from '../../../../../../../../../../lib/supabase';
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

type Resultado = 'conforme' | 'nao_conforme' | 'na';
type Conclusao = 'conforme' | 'nao_conforme' | 'em_andamento';

interface ItemRow { id: string; ordem: number; titulo: string; metodo_verif: string; tolerancia: string }
interface EquipeRow { id: string; nome: string; tipo: string }
interface FvsRow { id: string; subservico: string; revisao_associada: number; status: string }
interface UsuarioRow { id: string; nome: string; cargo: string }
interface CountRow { count: number }
interface LastPercentRow { percentual_exec: number }
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
  value: { width: 44, textAlign: 'right', fontSize: FontSizes.base, color: Colors.brand, fontWeight: '500' },
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
          {Platform.OS === 'web' ? (
            // @ts-ignore — input HTML nativo no PWA
            <input
              type="date"
              value={detail.data_nova_verif}
              onChange={(e: any) => onChange({ data_nova_verif: e.target.value })}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 6,
                border: '0.5px solid rgba(0,0,0,0.12)',
                padding: '7px 10px',
                fontSize: FontSizes.tiny,
                color: '#1A1A18',
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
  title:     { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.nok },
  badge:     { backgroundColor: Colors.nok, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: FontSizes.tiny, color: '#fff', fontWeight: '600' },
  label:     { fontSize: FontSizes.xs, fontWeight: '500', color: Colors.nok },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: '#f09595',
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
    borderRadius: Radius.sm, borderWidth: 0.5, borderColor: '#f09595',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    minHeight: 34,
  },
  selectText: { flex: 1, fontSize: FontSizes.sm, color: Colors.text },
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
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

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

  const { data: lastPercentRows } = useQuery<LastPercentRow>(`
    SELECT percentual_exec FROM verificacoes WHERE fvs_planejada_id = ? ORDER BY created_at DESC LIMIT 1
  `, [fvsId]);

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

  const { data: ncsAbertas } = useQuery<NcAbertaRow>(`
    SELECT nc.id as nc_id, nc.descricao, nc.numero_ocorrencia,
           nc.data_nova_verif, nc.responsavel_id,
           vi.fvs_padrao_item_id, vi.titulo,
           v.numero_verif, v.data_verif as nc_data_criacao
    FROM nao_conformidades nc
    JOIN verificacao_itens vi ON nc.verificacao_item_id = vi.id
    JOIN verificacoes v ON vi.verificacao_id = v.id
    WHERE v.fvs_planejada_id = ? AND nc.status = 'aberta'
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

  // Form state
  const [dataVerif, setDataVerif] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [showEquipePicker, setShowEquipePicker] = useState(false);
  const [percentExec, setPercentExec] = useState<number>(0);
  const [itemResults, setItemResults] = useState<Record<string, Resultado>>({});
  const [ncDetails, setNcDetails] = useState<Record<string, NcDetail>>({});
  const [observacoes, setObservacoes] = useState('');
  const [conclusao, setConclusao] = useState<Conclusao | null>(null);
  const [concluirFvs, setConcluirFvs] = useState(false);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reinspFoto, setReinspFoto] = useState<string | null>(null);
  const [reinspResult, setReinspResult] = useState<ReinspResult>({ type: 'idle' });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Derived values — must be declared BEFORE the useEffect calls that reference them
  const todosItensComResultado = itens.length > 0 && itens.every(i => itemResults[i.id] !== undefined);
  const algumNaoConforme = Object.values(itemResults).some(r => r === 'nao_conforme');
  const podeConcluir = todosItensComResultado && !algumNaoConforme;

  // Pré-preenche equipe da última verificação (editável pelo usuário)
  useEffect(() => {
    const equipeId = lastEquipeRows[0]?.equipe_id;
    if (equipeId && selectedEquipeId === null) {
      setSelectedEquipeId(equipeId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEquipeRows]);

  // Pré-preenche resultados da última verificação no modo de re-inspeção
  useEffect(() => {
    if (!hasOpenNCs || !ultimaVerifItens.length) return;
    setItemResults(prev => {
      const next = { ...prev };
      for (const row of ultimaVerifItens) {
        if (next[row.fvs_padrao_item_id] !== undefined) continue;
        const r = row.resultado as Resultado;
        if (r === 'conforme' || r === 'na') {
          next[row.fvs_padrao_item_id] = r;
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpenNCs, ultimaVerifItens]);

  // Pre-populate slider with last percentual_exec when FVS is em_andamento
  useEffect(() => {
    if (fvs?.status === 'em_andamento' && lastPercentRows[0]?.percentual_exec != null) {
      setPercentExec(lastPercentRows[0].percentual_exec);
    }
  }, [fvs?.status, lastPercentRows[0]?.percentual_exec]);

  // Auto-uncheck "Concluir FVS" if any item becomes nao_conforme
  useEffect(() => {
    if (algumNaoConforme && concluirFvs) {
      setConcluirFvs(false);
    }
  }, [algumNaoConforme]);

  function showToast(msg: string, type: 'success' | 'error', onDone?: () => void) {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
      onDone?.();
    }, 2200);
  }

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
    if (!hasOpenNCs && !conclusao && !concluirFvs) errs.conclusao = 'Selecione o resultado da verificação';
    if (!signaturePath && Platform.OS !== 'web') errs.assinatura = 'Assinatura digital obrigatória';

    if (hasOpenNCs && !reinspFoto) {
      errs.reinspFoto = 'Foto da re-inspeção obrigatória';
    }

    for (const item of itens) {
      if (!itemResults[item.id]) errs[`item_${item.id}`] = 'Classifique este item';
      if (itemResults[item.id] === 'nao_conforme' && !ncAbertoByItemId[item.id]) {
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
    // Validate concluirFvs intent before running full validation
    if (concluirFvs && !todosItensComResultado) {
      Alert.alert('Itens incompletos', 'Classifique todos os itens antes de concluir a FVS.');
      return;
    }

    if (!validate()) return;
    setIsSaving(true);

    const finalPercentExec = concluirFvs ? 100 : percentExec;
    const finalConclusao: Conclusao = concluirFvs ? 'conforme' : (conclusao ?? 'em_andamento');

    const verificacaoId = uuid();
    const now = new Date().toISOString();
    let pendingResult: ReinspResult = { type: 'idle' };

    try {
      await db.execute(`
        INSERT INTO verificacoes
          (id, fvs_planejada_id, numero_verif, inspetor_id, equipe_id, data_verif,
           percentual_exec, status, observacoes, created_offline, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        verificacaoId, fvsId, proximoNumero,
        userId ?? '', selectedEquipeId, dataVerif,
        finalPercentExec, finalConclusao,
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

      if (pendingResult.type !== 'idle') {
        setReinspResult(pendingResult);
      } else {
        showToast('Verificação salva com sucesso!', 'success', () => goBack());
      }
    } catch (err) {
      console.error('[NovaVerificacao] save error:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.';
      showToast(msg, 'error');
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

  // Guard: FVS concluída bloqueia nova verificação (RN-FVS-01)
  if (fvs && (fvs.status === 'concluida' || fvs.status === 'concluida_ressalva')) {
    return (
      <SafeAreaView style={st.safe}>
        <AppHeader
          title="Nova Verificação"
          subtitle={[ambienteNome, fvs.subservico].filter(Boolean).join(' · ')}
          showBack
          onBack={() => goBack()}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Text style={{ fontSize: 40 }}>🔒</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A18', textAlign: 'center' }}>
            Verificação bloqueada
          </Text>
          <Text style={{ fontSize: 14, color: '#5C5B57', textAlign: 'center', lineHeight: 22 }}>
            Este serviço está concluído.{'\n'}Para registrar uma nova verificação, solicite a reabertura no histórico da FVS.
          </Text>
          <Pressable
            style={{ backgroundColor: '#E84A1A', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 }}
            onPress={() => goBack()}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>← Voltar ao histórico</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      {/* ── Header ── */}
      <AppHeader
        title={hasOpenNCs ? 'Re-inspeção' : 'Nova Verificação'}
        subtitle={hasOpenNCs
          ? [ambienteNome, `Re-inspeção #${proximoNumero}`, fvs?.subservico].filter(Boolean).join(' · ')
          : [ambienteNome, `Verif. #${proximoNumero}`, fvs?.subservico].filter(Boolean).join(' · ')}
        showBack
        onBack={() => goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={st.content}>

          {/* ── Banner de re-inspeção ── */}
          {hasOpenNCs && (
            <NCReinspectionBanner
              itemTitle={ncsAbertas[0]?.titulo ?? ''}
              ncId={ncsAbertas[0]?.nc_id ?? ''}
            />
          )}

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
                  fontSize: FontSizes.base,
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
            {sortedItens.map((item, idx) => {
              const result = itemResults[item.id];
              const isNok = result === 'nao_conforme';
              const ncAberta = ncAbertoByItemId[item.id];
              const isNcItem = !!ncAberta;
              const showNcHeader = hasOpenNCs && idx === 0 && isNcItem;
              const showRestHeader = hasOpenNCs && !isNcItem && idx > 0 && !!ncAbertoByItemId[sortedItens[idx - 1]?.id];
              return (
                <View key={item.id}>
                  {showNcHeader && (
                    <Text style={st.reinspSectionHeader}>
                      {ncsAbertas.length > 1 ? 'ITENS COM NC ABERTA — AVALIAR AGORA' : 'ITEM QUE GEROU A NC — AVALIAR AGORA'}
                    </Text>
                  )}
                  {showRestHeader && (
                    <Text style={[st.reinspSectionHeader, { marginTop: Spacing.md }]}>DEMAIS ITENS</Text>
                  )}
                  <View style={[st.itemWrapper, isNok && st.itemWrapperNok, isNcItem && !isNok && st.itemWrapperReinsp]}>
                    {/* Layer 1: Header */}
                    <View style={[st.itemHeader, isNok && st.itemHeaderNok, isNcItem && !isNok && st.itemHeaderReinsp]}>
                      <View style={[st.itemNum, isNok && st.itemNumNok, isNcItem && !isNok && st.itemNumReinsp]}>
                        <Text style={[st.itemNumText, isNok && st.itemNumTextNok, isNcItem && !isNok && st.itemNumTextReinsp]}>{idx + 1}</Text>
                      </View>
                      <Text style={st.itemTitulo} numberOfLines={3}>{item.titulo}</Text>
                      {isNcItem && (
                        <View style={st.ncAbertaBadge}>
                          <Text style={st.ncAbertaBadgeText}>NC aberta</Text>
                        </View>
                      )}
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
                      {(() => {
                        const isLocked = hasOpenNCs && !isNcItem;
                        return (
                          <View style={[st.resultRow, isLocked && { opacity: 0.5 }]}
                            pointerEvents={isLocked ? 'none' : 'auto'}>
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
                        );
                      })()}
                      {isNok && !isNcItem && (
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
                </View>
              );
            })}
          </View>

          {/* ── 5b. Foto de re-inspeção ── */}
          {hasOpenNCs && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Foto da re-inspeção</Text>
              {errors.reinspFoto && <Text style={st.errorText}>{errors.reinspFoto}</Text>}
              <Pressable
                style={[
                  st.reinspPhotoBtn,
                  reinspFoto ? { borderStyle: 'solid' as const } : {},
                  errors.reinspFoto ? { borderColor: Colors.nok } : {},
                ]}
                onPress={async () => {
                  const path = await captureNcPhoto();
                  if (path) setReinspFoto(path);
                }}
              >
                {reinspFoto ? (
                  <Image source={{ uri: reinspFoto }} style={st.reinspPhotoThumb} resizeMode="cover" />
                ) : (
                  <Text style={[st.reinspPhotoBtnText, errors.reinspFoto ? { color: Colors.nok } : {}]}>
                    📷 Foto obrigatória *
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ── 6. Fotos gerais (apenas em verificação normal) ── */}
          {!hasOpenNCs && (
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
          )}

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

          {/* ── 8. Conclusão (apenas em verificação normal) ── */}
          {!hasOpenNCs && (
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
          )}

          {/* ── 8b. Concluir FVS (apenas em verificação normal) ── */}
          {!hasOpenNCs && (
            <View style={st.section}>
              <Pressable
                style={[st.concluirRow, concluirFvs && st.concluirRowActive, algumNaoConforme && st.concluirRowDisabled]}
                onPress={() => {
                  if (algumNaoConforme) return;
                  setConcluirFvs(prev => !prev);
                }}
              >
                <View style={[st.checkbox, concluirFvs && st.checkboxActive, algumNaoConforme && st.checkboxDisabled]}>
                  {concluirFvs && <Text style={st.checkboxTick}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.concluirLabel, algumNaoConforme && st.concluirLabelDisabled]}>
                    Concluir esta FVS
                  </Text>
                  {algumNaoConforme ? (
                    <Text style={st.concluirHint}>Não é possível concluir com itens não conformes</Text>
                  ) : !todosItensComResultado ? (
                    <Text style={st.concluirHint}>Classifique todos os itens para concluir</Text>
                  ) : (
                    <Text style={st.concluirHint}>Força percentual = 100% e status Conforme</Text>
                  )}
                </View>
              </Pressable>
            </View>
          )}

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

      {/* Re-inspeção aprovada */}
      <NCResolvedScreen
        visible={reinspResult.type === 'aprovada'}
        itemTitle={reinspResult.type === 'aprovada' ? reinspResult.itemTitle : ''}
        abertoEm={reinspResult.type === 'aprovada' ? reinspResult.abertoEm : null}
        resolvidoEm={reinspResult.type === 'aprovada' ? reinspResult.resolvidoEm : ''}
        responsavelNome={reinspResult.type === 'aprovada' ? reinspResult.responsavelNome : null}
        fotoUri={reinspResult.type === 'aprovada' ? reinspResult.fotoUri : null}
        onConcluir={() => goBack()}
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
        onSalvo={() => goBack()}
      />

      {/* Toast feedback */}
      {toast && (
        <View style={[st.toast, toast.type === 'success' ? st.toastSuccess : st.toastError]}>
          <Text style={st.toastText}>{toast.msg}</Text>
        </View>
      )}

      {/* Fixed save button */}
      <View style={st.saveBar}>
        <Pressable
          style={[st.saveBtn, isSaving && st.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving || !!toast}
        >
          {isSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={st.saveBtnText}>{hasOpenNCs ? 'Salvar re-inspeção' : 'Salvar verificação'}</Text>
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
  toast: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 12, zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
  },
  toastSuccess: { backgroundColor: Colors.ok },
  toastError:   { backgroundColor: Colors.nok },
  toastText:    { color: '#fff', fontSize: FontSizes.md, fontWeight: '500', textAlign: 'center' },
  content:    { padding: Spacing.lg, gap: Spacing.lg },
  section:    { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.textSecondary, marginBottom: 4 },

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
  inspectorAvatarText: { color: '#fff', fontSize: FontSizes.base, fontWeight: '700' },
  inspectorName:       { fontSize: FontSizes.base, fontWeight: '500', color: Colors.brand },
  inspectorRole:       { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 1 },
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
    borderRadius: Radius.sm,
    borderWidth: 0.5, borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSizes.base, color: Colors.text,
  },

  // Equipe
  teamCard: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  teamSelect: { padding: Spacing.md, gap: 6 },
  teamSelectLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '500' },
  teamSelectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  teamSelectBtnText: { flex: 1, fontSize: FontSizes.base, color: Colors.text },
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
  teamAvatarText:  { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },
  teamName:        { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.text },
  tipoBadge:       { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tipoBadgeGreen:  { backgroundColor: Colors.okBg },
  tipoBadgeBlue:   { backgroundColor: Colors.progressBg },
  tipoBadgeText:       { fontSize: FontSizes.tiny, fontWeight: '500' },
  tipoBadgeTextGreen:  { color: Colors.ok },
  tipoBadgeTextBlue:   { color: Colors.progress },
  equipePickerTipo:    { fontSize: FontSizes.xs, color: Colors.textTertiary, marginTop: 2 },

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
  itemNumText:    { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.textSecondary },
  itemNumTextNok: { color: Colors.nok },
  itemTitulo:     { flex: 1, fontSize: FontSizes.base, fontWeight: '500', color: Colors.text, lineHeight: 18 },

  itemMethod: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 13, paddingVertical: 9,
    gap: 10,
  },
  itemMethodLabel: { fontSize: FontSizes.tiny, fontWeight: '500', color: Colors.textTertiary, letterSpacing: 0.4, marginBottom: 2 },
  itemMethodText:  { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 17 },

  toleranciaBadge: { alignItems: 'flex-end' },
  toleranciaLabel: { fontSize: FontSizes.tiny, fontWeight: '500', color: Colors.textTertiary, letterSpacing: 0.4, marginBottom: 2 },
  toleranciaText:  { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.progress },

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
  resultBtnText: { fontSize: FontSizes.xs, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },

  // Photos
  photoBtns:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  photoActionText: { fontSize: FontSizes.base, color: Colors.progress, fontWeight: '500' },
  photoCount:      { fontSize: FontSizes.sm, color: Colors.textTertiary, marginLeft: 'auto' as any },

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
  conclusaoBtnText: { fontSize: FontSizes.tiny, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },

  // Assinatura
  signatureResponsavel: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: 2 },
  signedConfirm: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.okBg,
    borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.ok,
    padding: Spacing.md, gap: Spacing.sm,
  },
  signedText:  { flex: 1, fontSize: FontSizes.sm, color: Colors.ok, fontWeight: '500' },
  refazerText: { fontSize: FontSizes.xs, color: Colors.nok, fontWeight: '500' },
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
  signatureHint: { fontSize: FontSizes.xs, color: Colors.textTertiary },

  // Save bar
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn:         { backgroundColor: Colors.brand, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontSize: FontSizes.md, fontWeight: '600' },

  errorText: { fontSize: FontSizes.xs, color: Colors.nok, fontWeight: '500' },

  // Re-inspeção
  reinspSectionHeader: { fontSize: 10, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  itemWrapperReinsp:   { borderColor: Colors.nok, borderWidth: 1.5 },
  itemHeaderReinsp:    { backgroundColor: Colors.nokBg },
  itemNumReinsp:       { backgroundColor: Colors.nokBg, borderWidth: 0.5, borderColor: Colors.nok },
  itemNumTextReinsp:   { color: Colors.nok },
  ncAbertaBadge:       { backgroundColor: Colors.nok, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  ncAbertaBadgeText:   { fontSize: 9, color: '#fff', fontWeight: '700' },
  reinspPhotoBtn: {
    height: 80,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.nok,
    borderStyle: 'dashed',
    backgroundColor: Colors.nokBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reinspPhotoBtnText: { fontSize: FontSizes.sm, color: Colors.nok, fontWeight: '500' },
  reinspPhotoThumb:   { width: '100%' as any, height: '100%' as any },

  // Concluir FVS
  concluirRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderNormal,
    padding: Spacing.md,
  },
  concluirRowActive: { borderColor: Colors.ok, backgroundColor: Colors.okBg },
  concluirRowDisabled: { opacity: 0.5 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxActive: { backgroundColor: Colors.ok, borderColor: Colors.ok },
  checkboxDisabled: { borderColor: Colors.na, backgroundColor: Colors.surface2 },
  checkboxTick: { color: '#fff', fontSize: FontSizes.base, fontWeight: '700' },
  concluirLabel: { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text },
  concluirLabelDisabled: { color: Colors.textTertiary },
  concluirHint: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
});
