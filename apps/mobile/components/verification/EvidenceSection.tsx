import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Field, PhotoSlot } from '../ui';
import { PhotoGrid } from '../PhotoGrid';
import { Colors, FontFamily, FontSizes, Spacing, Typography } from '../../lib/constants';

interface Props {
  isReinspection: boolean;
  reinspFoto: string | null;
  onCaptureReinsp: () => void;
  reinspError?: string;
  photos: string[];
  onAddCamera: () => void;
  onAddGallery: () => void;
  onRemovePhoto: (index: number) => void;
  observacoes: string;
  onObservacoesChange: (value: string) => void;
}

/** Evidence block for the closing step: reinspection photo or the general
 * evidence grid, plus free-form observations. */
export function EvidenceSection({
  isReinspection,
  reinspFoto,
  onCaptureReinsp,
  reinspError,
  photos,
  onAddCamera,
  onAddGallery,
  onRemovePhoto,
  observacoes,
  onObservacoesChange,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.overline}>EVIDÊNCIAS</Text>

      {isReinspection ? (
        <PhotoSlot
          uri={reinspFoto}
          onPress={onCaptureReinsp}
          label="Adicionar foto da reinspeção"
          height={140}
          required
          error={reinspError}
          accessibilityLabel={reinspFoto ? 'Substituir foto da reinspeção' : 'Adicionar foto da reinspeção'}
        />
      ) : (
        <View style={styles.evidenceBlock}>
          <View style={styles.headerRow}>
            <Text style={styles.label}>Fotos de evidência</Text>
            <Text style={styles.count}>{photos.length}/10</Text>
          </View>
          {photos.length > 0 ? (
            <PhotoGrid photos={photos} max={10} onRemove={onRemovePhoto} />
          ) : null}
          <View style={styles.photoButtons}>
            <Button label="Usar câmera" onPress={onAddCamera} Icon={Camera} variant="secondary" />
            <Button label="Galeria" onPress={onAddGallery} Icon={ImageIcon} variant="secondary" />
          </View>
        </View>
      )}

      <Field
        label="Observações gerais"
        multiline
        numberOfLines={3}
        placeholder="Ocorrências, condições do ambiente e informações úteis…"
        value={observacoes}
        onChangeText={onObservacoesChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.lg },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  evidenceBlock: { gap: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...Typography.label, color: Colors.text },
  count: { fontFamily: FontFamily.mono, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  photoButtons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
