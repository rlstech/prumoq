import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  ChevronLeft,
  Image as ImageIcon,
  Lock,
  PenLine,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
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

type Resultado = 'conforme' | 'nao_conforme' | 'na';
type Conclusao = 'conforme' | 'nao_conforme' | 'em_andamento';

interface ItemRow { id: string; ordem: number; titulo: string; metodo_verif: string; tolerancia: string }
interface EquipeRow { id: string; nome: string; tipo: string }
interface FvsRow { id: string; subservico: string; revisao_associada: number; fvs_planejada_id?: string }
interface UsuarioRow { id: string; nome: string; cargo: string }
interface CountRow { count: number }

interface NcDetail {
  descricao: string;
  solucao_proposta: string;
  data_nova_verif: string;
  responsavel_id: string;
  foto: string | null;
}

// Animated NC panel controlled by item selection
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
  const height = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(height, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={ncStyles.panel}>
      <View style={ncStyles.panelHeader}>
        <Text style={ncStyles.panelTitle}>Não Conformidade</Text>
        <View style={ncStyles.obrigBadge}><Text style={ncStyles.obrigText}>Obrigatório</Text></View>
      </View>

      <Text style={ncStyles.label}>Descrição *</Text>
      <TextInput
        style={ncStyles.input}
        multiline
        numberOfLines={3}
        placeholder="Descreva o problema encontrado..."
        placeholderTextColor={Colors.textTertiary}
        value={detail.descricao}
        onChangeText={t => onChange({ descricao: t })}
      />

      <Text style={ncStyles.label}>Foto de evidência *</Text>
      {detail.foto ? (
        <PhotoGrid photos={[detail.foto]} onRemove={() => onChange({ foto: null })} />
      ) : (
        <Pressable style={ncStyles.photoBtn} onPress={onAddPhoto}>
          <Camera size={16} color={Colors.progress} />
          <Text style={ncStyles.photoBtnText}>Tirar foto</Text>
        </Pressable>
      )}

      <Text style={ncStyles.label}>Solução proposta *</Text>
      <TextInput
        style={ncStyles.input}
        multiline
        numberOfLines={2}
        placeholder="Descreva a ação corretiva..."
        placeholderTextColor={Colors.textTertiary}
        value={detail.solucao_proposta}
        onChangeText={t => onChange({ solucao_proposta: t })}
      />

      <Text style={ncStyles.label}>Nova data de verificação *</Text>
      <TextInput
        style={ncStyles.input}
        placeholder="AAAA-MM-DD"
        placeholderTextColor={Colors.textTertiary}
        value={detail.data_nova_verif}
        onChangeText={t => onChange({ data_nova_verif: t })}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />

      <Text style={ncStyles.label}>Responsável pela correção</Text>
      <View style={ncStyles.respRow}>
        {equipes.map(eq => (
          <Pressable
            key={eq.id}
            style={[ncStyles.respChip, detail.responsavel_id === eq.id && ncStyles.respChipActive]}
            onPress={() => onChange({ responsavel_id: eq.id })}
          >
            <Text style={[ncStyles.respChipText, detail.responsavel_id === eq.id && ncStyles.respChipTextActive]}>
              {eq.nome}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const ncStyles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.nok,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  panelTitle: { fontSize: 12, fontWeight: '600', color: Colors.nok },
  obrigBadge: {
    backgroundColor: Colors.nok,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  obrigText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '500', color: Colors.text },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    padding: Spacing.sm,
    fontSize: 13,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignSelf: 'flex-start',
  },
  photoBtnText: { fontSize: 13, color: Colors.progress, fontWeight: '500' },
  respRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  respChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
  },
  respChipActive: { backgroundColor: Colors.progress, borderColor: Colors.progress },
  respChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  respChipTextActive: { color: '#fff' },
});

export default function NovaVerificacaoScreen() {
  const { id, ambId, fvsId } = useLocalSearchParams<{ id: string; ambId: string; fvsId: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<(View | null)[]>([]);

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
  const [selectedEquipeIds, setSelectedEquipeIds] = useState<string[]>([]);
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

  function toggleEquipe(eid: string) {
    setSelectedEquipeIds(prev =>
      prev.includes(eid) ? prev.filter(e => e !== eid) : [...prev, eid]
    );
  }

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
    if (selectedEquipeIds.length === 0) errs.equipe = 'Selecione ao menos uma equipe';
    if (!conclusao) errs.conclusao = 'Selecione o resultado da verificação';
    if (!signaturePath) errs.assinatura = 'Assinatura digital obrigatória';

    for (const item of itens) {
      if (!itemResults[item.id]) errs[`item_${item.id}`] = 'Classifique este item';
      if (itemResults[item.id] === 'nao_conforme') {
        const nc = ncDetails[item.id];
        if (!nc?.descricao)       errs[`nc_desc_${item.id}`] = 'Descrição obrigatória';
        if (!nc?.foto)            errs[`nc_foto_${item.id}`] = 'Foto obrigatória';
        if (!nc?.solucao_proposta) errs[`nc_sol_${item.id}`] = 'Solução obrigatória';
        if (!nc?.data_nova_verif) errs[`nc_data_${item.id}`] = 'Data obrigatória';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setIsSaving(true);

    const verificacaoId = uuid();
    const now = new Date().toISOString();

    try {
      // Insert verificacao
      await db.execute(`
        INSERT INTO verificacoes
          (id, fvs_planejada_id, numero_verif, inspetor_id, data_verif,
           percentual_exec, status, observacoes, created_offline, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [
        verificacaoId, fvsId, proximoNumero,
        userId ?? '', dataVerif,
        percentExec, conclusao ?? 'em_andamento',
        observacoes, now,
      ]);

      // Insert verificacao_itens
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

        // Insert NC if non-conforme
        if (resultado === 'nao_conforme') {
          const nc = ncDetails[item.id];
          if (nc) {
            const ncId = uuid();
            await db.execute(`
              INSERT INTO nao_conformidades
                (id, verificacao_id, verificacao_item_id, descricao,
                 solucao_proposta, responsavel_id, data_nova_verif,
                 status, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'aberta', ?)
            `, [ncId, verificacaoId, itemVerifId, nc.descricao,
                nc.solucao_proposta, nc.responsavel_id || null,
                nc.data_nova_verif, now]);

            // NC photo
            if (nc.foto) {
              await db.execute(`
                INSERT INTO nc_fotos
                  (id, nc_id, r2_key, nome_arquivo, mime_type, ordem)
                VALUES (?, ?, ?, ?, 'image/jpeg', 0)
              `, [uuid(), ncId, `pending:${nc.foto}`, nc.foto.split('/').pop() ?? 'nc.jpg']);
            }
          }
        }
      }

      // General photos
      for (let i = 0; i < generalPhotos.length; i++) {
        const localPath = generalPhotos[i];
        await db.execute(`
          INSERT INTO verificacao_fotos
            (id, verificacao_id, r2_key, nome_arquivo, mime_type, ordem)
          VALUES (?, ?, ?, ?, 'image/jpeg', ?)
        `, [uuid(), verificacaoId, `pending:${localPath}`, localPath.split('/').pop() ?? 'photo.jpg', i]);
      }

      // Signature
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

  const conclusaoOptions: { key: Conclusao; label: string; color: string }[] = [
    { key: 'conforme',     label: 'Conforme',     color: Colors.ok },
    { key: 'nao_conforme', label: 'Não conforme', color: Colors.nok },
    { key: 'em_andamento', label: 'Em andamento', color: Colors.progress },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Nova Verificação #{proximoNumero}</Text>
          <Text style={styles.subtitle}>{fvs?.subservico || 'FVS'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* 1. Inspector */}
          <View style={[styles.section, styles.inspectorCard]}>
            <Lock size={14} color="rgba(255,255,255,0.8)" />
            <View style={{ flex: 1 }}>
              <Text style={styles.inspectorName}>{usuario?.nome ?? 'Inspetor'}</Text>
              <Text style={styles.inspectorRole}>{usuario?.cargo ?? 'Inspetor de Campo'}</Text>
            </View>
          </View>

          {/* 2. Data */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DATA DA VERIFICAÇÃO</Text>
            <TextInput
              style={styles.input}
              value={dataVerif}
              onChangeText={setDataVerif}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>

          {/* 3. Equipe */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EQUIPE EXECUTORA</Text>
            {errors.equipe && <Text style={styles.errorText}>{errors.equipe}</Text>}
            <View style={styles.chipRow}>
              {equipes.map(eq => (
                <Pressable
                  key={eq.id}
                  style={[styles.teamChip, selectedEquipeIds.includes(eq.id) && styles.teamChipActive]}
                  onPress={() => toggleEquipe(eq.id)}
                >
                  <Text style={[styles.teamChipText, selectedEquipeIds.includes(eq.id) && styles.teamChipTextActive]}>
                    {eq.nome}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedEquipeIds.length > 0 && (
              <View style={styles.teamConfirm}>
                <Text style={styles.teamConfirmText}>
                  {selectedEquipeIds.length} equipe{selectedEquipeIds.length > 1 ? 's' : ''} selecionada{selectedEquipeIds.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          {/* 4. % Execução */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EXECUÇÃO</Text>
            <View style={styles.percentRow}>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
                <Pressable
                  key={v}
                  style={[styles.percentChip, percentExec === v && styles.percentChipActive]}
                  onPress={() => setPercentExec(v)}
                >
                  <Text style={[styles.percentChipText, percentExec === v && styles.percentChipTextActive]}>
                    {v}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 5. Itens do checklist */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ITENS DE VERIFICAÇÃO</Text>
            {itens.map((item, idx) => (
              <View key={item.id} style={styles.checklistItem}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemNum}>
                    <Text style={styles.itemNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.itemTitulo} numberOfLines={3}>{item.titulo}</Text>
                </View>
                {item.metodo_verif ? (
                  <Text style={styles.itemMetodo}>{item.metodo_verif}</Text>
                ) : null}
                {item.tolerancia ? (
                  <View style={styles.toleranciaBadge}>
                    <Text style={styles.toleranciaText}>{item.tolerancia}</Text>
                  </View>
                ) : null}
                {errors[`item_${item.id}`] && <Text style={styles.errorText}>{errors[`item_${item.id}`]}</Text>}
                <View style={styles.resultRow}>
                  {(['conforme', 'nao_conforme', 'na'] as Resultado[]).map(r => (
                    <Pressable
                      key={r}
                      style={[styles.resultBtn, itemResults[item.id] === r && resultBtnActive(r)]}
                      onPress={() => setItemResult(item.id, r)}
                    >
                      <Text style={[styles.resultBtnText, itemResults[item.id] === r && resultBtnTextActive(r)]}>
                        {r === 'conforme' ? 'Conforme' : r === 'nao_conforme' ? 'Não conforme' : 'N/A'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {itemResults[item.id] === 'nao_conforme' && (
                  <NcPanel
                    visible
                    detail={ncDetails[item.id] ?? { descricao: '', solucao_proposta: '', data_nova_verif: '', responsavel_id: '', foto: null }}
                    onChange={patch => updateNc(item.id, patch)}
                    onAddPhoto={() => addNcPhoto(item.id)}
                    equipes={equipes}
                  />
                )}
              </View>
            ))}
          </View>

          {/* 6. Fotos gerais */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FOTOS DE EVIDÊNCIA</Text>
            <View style={styles.photoBtns}>
              <Pressable style={styles.photoActionBtn} onPress={addFromCamera}>
                <Camera size={16} color={Colors.progress} />
                <Text style={styles.photoActionText}>Câmera</Text>
              </Pressable>
              <Pressable style={styles.photoActionBtn} onPress={addFromGallery}>
                <ImageIcon size={16} color={Colors.progress} />
                <Text style={styles.photoActionText}>Galeria</Text>
              </Pressable>
              <Text style={styles.photoCount}>{generalPhotos.length}/10</Text>
            </View>
            {generalPhotos.length > 0 && (
              <PhotoGrid photos={generalPhotos} max={10} onRemove={removePhoto} />
            )}
          </View>

          {/* 7. Observações */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OBSERVAÇÕES GERAIS</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              multiline
              placeholder="Observações sobre a verificação..."
              placeholderTextColor={Colors.textTertiary}
              value={observacoes}
              onChangeText={setObservacoes}
              textAlignVertical="top"
            />
          </View>

          {/* 8. Conclusão */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RESULTADO DA VERIFICAÇÃO</Text>
            {errors.conclusao && <Text style={styles.errorText}>{errors.conclusao}</Text>}
            <View style={styles.conclusaoRow}>
              {conclusaoOptions.map(opt => (
                <Pressable
                  key={opt.key}
                  style={[styles.conclusaoBtn, conclusao === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]}
                  onPress={() => setConclusao(opt.key)}
                >
                  <Text style={[styles.conclusaoBtnText, conclusao === opt.key && { color: '#fff' }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 9. Assinatura */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ASSINATURA DIGITAL</Text>
            {errors.assinatura && <Text style={styles.errorText}>{errors.assinatura}</Text>}
            {signaturePath ? (
              <View style={styles.signedConfirm}>
                <PenLine size={16} color={Colors.ok} />
                <Text style={styles.signedText}>Assinatura registrada</Text>
                <Pressable onPress={() => setSignaturePath(null)}>
                  <Text style={styles.refazerText}>Refazer</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.signatureArea, errors.assinatura && { borderColor: Colors.nok }]} onPress={() => setShowSignature(true)}>
                <PenLine size={20} color={errors.assinatura ? Colors.nok : Colors.textTertiary} />
                <Text style={[styles.signatureHint, errors.assinatura && { color: Colors.nok }]}>Toque para assinar com o dedo</Text>
              </Pressable>
            )}
          </View>

          {/* Spacer for save button */}
          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Signature modal */}
      <SignatureField
        visible={showSignature}
        onSign={(path) => { setSignaturePath(path); setShowSignature(false); }}
        onCancel={() => setShowSignature(false)}
      />

      {/* Fixed save button */}
      <View style={styles.saveBar}>
        <Pressable
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Salvar Verificação</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function resultBtnActive(r: Resultado): object {
  if (r === 'conforme')     return { backgroundColor: Colors.ok, borderColor: Colors.ok };
  if (r === 'nao_conforme') return { backgroundColor: Colors.nok, borderColor: Colors.nok };
  return { backgroundColor: Colors.na, borderColor: Colors.na };
}
function resultBtnTextActive(_r: Resultado): object {
  return { color: '#fff' };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  headerText: { flex: 1 },
  title: { color: '#fff', fontSize: 17, fontWeight: '500' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inspectorCard: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inspectorName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  inspectorRole: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  teamChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  teamChipActive: { backgroundColor: Colors.progress, borderColor: Colors.progress },
  teamChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  teamChipTextActive: { color: '#fff' },
  teamConfirm: {
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  teamConfirmText: { fontSize: 12, color: Colors.progress, fontWeight: '500' },
  percentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  percentChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
  },
  percentChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  percentChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  percentChipTextActive: { color: '#fff' },
  checklistItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  itemNum: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNumText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  itemTitulo: { flex: 1, fontSize: 13, fontWeight: '500', color: Colors.text },
  itemMetodo: { fontSize: 11, color: Colors.textSecondary },
  toleranciaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  toleranciaText: { fontSize: 10, color: Colors.progress, fontWeight: '500' },
  resultRow: { flexDirection: 'row', gap: Spacing.xs },
  resultBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderNormal,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: Colors.surface2,
  },
  resultBtnText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  photoBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  photoActionText: { fontSize: 13, color: Colors.progress, fontWeight: '500' },
  photoCount: { fontSize: 12, color: Colors.textTertiary, marginLeft: 'auto' },
  conclusaoRow: { flexDirection: 'row', gap: Spacing.sm },
  conclusaoBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderNormal,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  conclusaoBtnText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  signedConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.okBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  signedText: { flex: 1, fontSize: 13, color: Colors.ok, fontWeight: '500' },
  refazerText: { fontSize: 13, color: Colors.progress },
  signatureArea: {
    height: 100,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderNormal,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  signatureHint: { fontSize: 13, color: Colors.textTertiary },
  signatureModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    zIndex: 100,
  },
  signatureClose: {
    padding: Spacing.lg,
    alignItems: 'center',
    backgroundColor: Colors.surface2,
  },
  signatureCloseText: { fontSize: 15, color: Colors.nok, fontWeight: '500' },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  errorText: { fontSize: 11, color: Colors.nok, fontWeight: '500' },
});
