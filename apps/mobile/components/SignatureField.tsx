import * as FileSystem from 'expo-file-system';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const sigRef = useRef<SignatureCanvas>(null);

  if (!visible) return null;

  function handleSave() {
    sigRef.current?.readSignature();
  }

  function handleClear() {
    sigRef.current?.clearSignature();
  }

  async function handleOK(sig: string) {
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
  }

  // On web: use position fixed to cover the tab bar (which is also fixed).
  // On native: use absoluteFillObject.
  const overlayStyle = Platform.OS === 'web'
    ? {
        // @ts-ignore — React Native Web forwards these to the DOM
        position: 'fixed' as any,
        top: 0, right: 0, bottom: 0, left: 0,
        zIndex: 99999,
        backgroundColor: '#fff',
        display: 'flex' as any,
        flexDirection: 'column' as any,
      }
    : styles.overlayNative;

  return (
    <View style={overlayStyle}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onCancel} hitSlop={12}>
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Assinatura Digital</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Hint */}
      <View style={styles.hint}>
        <Text style={styles.hintText}>Assine com o dedo ou mouse na área abaixo</Text>
      </View>

      {/* Canvas — hide built-in footer, control via ref */}
      <View style={{ flex: 1 }}>
        <SignatureCanvas
          ref={sigRef}
          onOK={handleOK}
          onEmpty={() => { /* empty canvas — no-op, user must draw first */ }}
          descriptionText=""
          clearText=""
          confirmText=""
          webStyle={`
            .m-signature-pad { box-shadow: none; border: none; height: 100%; }
            .m-signature-pad--footer { display: none; }
            .m-signature-pad--body { border: none; }
          `}
          style={{ flex: 1 }}
        />
      </View>

      {/* Our own footer buttons — always in RN layer, never hidden by WebView */}
      <View style={styles.footer}>
        <Pressable style={styles.btnClear} onPress={handleClear}>
          <Text style={styles.btnClearText}>↺ Limpar</Text>
        </Pressable>
        <Pressable style={styles.btnSave} onPress={handleSave}>
          <Text style={styles.btnSaveText}>✓ Salvar Assinatura</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayNative: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 99999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
  backBtn: { width: 80, paddingVertical: 4 },
  backText: { fontSize: 14, fontWeight: '500', color: Colors.brand },
  title: { fontSize: 15, fontWeight: '600', color: Colors.text },
  hint: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  hintText: { fontSize: 12, color: Colors.textTertiary },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'web' ? Spacing.xl : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
  btnClear: {
    flex: 0.35,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
  },
  btnClearText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  btnSave: {
    flex: 0.65,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: Colors.brand,
  },
  btnSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
