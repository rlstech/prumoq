import * as FileSystem from 'expo-file-system';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Colors, Radius, Spacing } from '../lib/constants';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface Props {
  visible: boolean;
  onSign: (path: string) => void;
  onCancel: () => void;
}

export function SignatureField({ visible, onSign, onCancel }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.modal}>
      <SignatureCanvas
        onOK={async (sig) => {
          try {
            const base64 = sig.replace(/^data:image\/png;base64,/, '');
            const dest = `${FileSystem.cacheDirectory}sig_${uuid()}.png`;
            await FileSystem.writeAsStringAsync(dest, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            onSign(dest);
          } catch (e) {
            console.error('Signature save error', e);
            onCancel();
          }
        }}
        onEmpty={onCancel}
        descriptionText="Assine aqui"
        clearText="Limpar"
        confirmText="Confirmar"
        webStyle={`.m-signature-pad--footer { background: ${Colors.surface2}; }`}
        style={{ flex: 1 }}
      />
      <Pressable style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 100,
  },
  cancelBtn: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.nok,
    fontSize: 14,
    fontWeight: '500',
  },
});
