import { CheckCircle2, PenLine } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DataRow } from '../ui';
import { SignatureField } from '../SignatureField';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../../lib/constants';

interface Props {
  signerName: string;
  signaturePath: string | null;
  error?: string;
  /** Web: called by the inline canvas when the signature is confirmed. */
  onSign: (path: string) => void;
  /** Clears the current signature; on native this also reopens the modal. */
  onRefazer: () => void;
  /** Native only: opens the signature modal for a first-time signature. */
  onOpenModal: () => void;
  /** Uses the user's reusable signature instead of accepting a per-document drawing. */
  standard?: boolean;
}

/** Digital signature block. Web renders the canvas inline; native opens a
 * modal (owned by the screen, since it must sit outside the scroll tree). */
export function SignatureSection({ signerName, signaturePath, error, onSign, onRefazer, onOpenModal, standard = false }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.overline}>ASSINATURA DIGITAL *</Text>
      <Text style={styles.responsavel}>
        Responsável: <Text style={styles.responsavelName}>{signerName}</Text>
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {standard ? (
        <DataRow
          label="Assinatura padrão"
          value={signaturePath ? 'Será aplicada automaticamente' : 'Cadastre-a no Perfil para concluir'}
          leading={<PenLine size={18} color={signaturePath ? Colors.ok : Colors.brand} />}
          last
          style={signaturePath ? styles.signedRow : undefined}
        />
      ) : signaturePath ? (
        <DataRow
          label="Assinatura"
          value="Registrada"
          leading={<CheckCircle2 size={18} color={Colors.ok} />}
          trailing={(
            <Pressable accessibilityRole="button" onPress={onRefazer}>
              <Text style={styles.refazer}>Refazer</Text>
            </Pressable>
          )}
          last
          style={styles.signedRow}
        />
      ) : Platform.OS === 'web' ? (
        <SignatureField visible inline onSign={onSign} onCancel={() => {}} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir área de assinatura"
          onPress={onOpenModal}
          style={[styles.area, error && styles.areaError]}
        >
          <PenLine size={24} color={error ? Colors.nok : Colors.brand} />
          <Text style={[styles.hint, error && styles.hintError]}>Toque para assinar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  responsavel: { ...Typography.caption, color: Colors.textSecondary },
  responsavelName: { color: Colors.text, fontFamily: FontFamily.semibold },
  error: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },
  signedRow: { backgroundColor: Colors.okBg, borderRadius: Radius.md },
  refazer: { ...Typography.label, color: Colors.brand },
  area: {
    height: 88,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  areaError: { borderColor: Colors.nok },
  hint: { ...Typography.label, color: Colors.brand },
  hintError: { color: Colors.nok },
});
