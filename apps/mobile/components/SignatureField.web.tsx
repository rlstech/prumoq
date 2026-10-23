import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Check, RotateCcw, Trash2 } from '../lib/icons';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../lib/constants';
import { Button, IconButton } from './ui';

interface Props {
  visible: boolean;
  /** Recebe o PNG (data URL) já recortado. Se devolver uma Promise, a tela espera e mostra o erro dela. */
  onSign: (dataUrl: string) => void | Promise<void>;
  onCancel: () => void;
  /** Renderiza inline no fluxo da página em vez de sobrepor a tela toda. */
  inline?: boolean;
  title?: string;
  description?: string;
  /** Assinatura já cadastrada, mostrada para comparação ao alterar. */
  currentUri?: string | null;
  /** Salvamento em andamento controlado por quem abriu (ex.: Perfil). */
  saving?: boolean;
  error?: string | null;
  confirmLabel?: string;
}

type PointGroups = ReturnType<SignatureCanvas['toData']>;

/** Área de desenho: canvas na resolução do aparelho, linha de base e controle de traços. */
function useSignaturePad() {
  const padRef = useRef<SignatureCanvas>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState(0);

  const fit = useCallback(() => {
    const pad = padRef.current;
    const box = boxRef.current;
    if (!pad || !box) return;
    const canvas = pad.getCanvas();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.round(box.clientWidth * ratio);
    const height = Math.round(box.clientHeight * ratio);
    if (!width || !height || (canvas.width === width && canvas.height === height)) return;
    // Mudar o tamanho apaga o canvas: guarda os traços e redesenha (girar o celular não perde a assinatura).
    const data = pad.toData();
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.scale(ratio, ratio);
    pad.clear();
    if (data.length) pad.fromData(data);
  }, []);

  useLayoutEffect(() => {
    fit();
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    return () => observer.disconnect();
  }, [fit]);

  const undo = useCallback(() => {
    const pad = padRef.current;
    if (!pad) return;
    const data: PointGroups = pad.toData();
    data.pop();
    pad.clear();
    if (data.length) pad.fromData(data);
    setStrokes(data.length);
  }, []);

  const clear = useCallback(() => {
    padRef.current?.clear();
    setStrokes(0);
  }, []);

  const exportPng = useCallback((): string | null => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return null;
    return trimmedPng(pad.getCanvas());
  }, []);

  const surface = (
    <div ref={boxRef} style={padBox}>
      <SignatureCanvas
        ref={padRef}
        clearOnResize={false}
        penColor={Colors.text}
        minWidth={0.9}
        maxWidth={2.8}
        velocityFilterWeight={0.6}
        onEnd={() => setStrokes(padRef.current?.toData().length ?? 0)}
        canvasProps={{
          'aria-label': 'Área de assinatura',
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' },
        }}
      />
      <div style={baseline} aria-hidden>
        <span style={baselineMark}>X</span>
      </div>
      {strokes === 0 ? <div style={placeholder} aria-hidden>Assine aqui com o dedo</div> : null}
    </div>
  );

  return { surface, strokes, undo, clear, exportPng };
}

/** Recorta as sobras transparentes (com margem) para a assinatura ocupar bem o espaço nos documentos. */
function trimmedPng(source: HTMLCanvasElement): string {
  const context = source.getContext('2d');
  if (!context) return source.toDataURL('image/png');
  const { width, height } = source;
  const pixels = context.getImageData(0, 0, width, height).data;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return source.toDataURL('image/png');
  const margin = Math.round(12 * Math.max(window.devicePixelRatio || 1, 1));
  left = Math.max(0, left - margin);
  top = Math.max(0, top - margin);
  right = Math.min(width - 1, right + margin);
  bottom = Math.min(height - 1, bottom + margin);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  // Teto de 1200 px de largura: nítido na impressão sem inflar a fila de envio.
  const scale = Math.min(1, 1200 / cropWidth);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(cropWidth * scale));
  output.height = Math.max(1, Math.round(cropHeight * scale));
  output.getContext('2d')?.drawImage(source, left, top, cropWidth, cropHeight, 0, 0, output.width, output.height);
  return output.toDataURL('image/png');
}

export function SignatureField({
  visible,
  onSign,
  onCancel,
  inline = false,
  title = 'Assinatura',
  description = 'Desenhe sua assinatura acima da linha.',
  currentUri,
  saving = false,
  error,
  confirmLabel,
}: Props) {
  if (!visible) return null;
  return inline
    ? <InlinePad onSign={onSign} confirmLabel={confirmLabel ?? 'Confirmar assinatura'} />
    : (
      <OverlayPad
        onSign={onSign}
        onCancel={onCancel}
        title={title}
        description={description}
        currentUri={currentUri ?? null}
        saving={saving}
        error={error ?? null}
        confirmLabel={confirmLabel ?? 'Salvar assinatura'}
      />
    );
}

function InlinePad({ onSign, confirmLabel }: { onSign: Props['onSign']; confirmLabel: string }) {
  const { surface, strokes, undo, clear, exportPng } = useSignaturePad();
  const empty = strokes === 0;
  return (
    <View style={styles.inline}>
      <View style={styles.inlineCanvas}>{surface}</View>
      <View style={styles.tools}>
        <Button label="Desfazer" Icon={RotateCcw} variant="ghost" onPress={undo} disabled={empty} />
        <Button label="Limpar" Icon={Trash2} variant="ghost" onPress={clear} disabled={empty} />
      </View>
      <Button
        label={confirmLabel}
        Icon={Check}
        fullWidth
        disabled={empty}
        onPress={() => {
          const png = exportPng();
          if (png) void onSign(png);
        }}
      />
    </View>
  );
}

function OverlayPad({
  onSign,
  onCancel,
  title,
  description,
  currentUri,
  saving,
  error,
  confirmLabel,
}: Required<Pick<Props, 'onSign' | 'onCancel'>> & {
  title: string;
  description: string;
  currentUri: string | null;
  saving: boolean;
  error: string | null;
  confirmLabel: string;
}) {
  const { surface, strokes, undo, clear, exportPng } = useSignaturePad();
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = saving || submitting;
  const empty = strokes === 0;

  const save = useCallback(async () => {
    const png = exportPng();
    if (!png) {
      setLocalError('Desenhe sua assinatura antes de salvar.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await onSign(png);
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível salvar a assinatura.');
    } finally {
      setSubmitting(false);
    }
  }, [exportPng, onSign]);

  // A página por trás não rola enquanto a assinatura está aberta; Esc fecha e Ctrl+Z desfaz.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onCancel, undo]);

  const message = localError ?? error;

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label={title}>
      <View style={styles.header}>
        <IconButton label="Voltar" Icon={ArrowLeft} onPress={onCancel} disabled={busy} style={styles.back} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      {currentUri ? (
        <View style={styles.current}>
          <Text style={styles.currentLabel}>Atual</Text>
          <Image source={{ uri: currentUri }} style={styles.currentImage} resizeMode="contain" accessibilityLabel="Assinatura atual" />
        </View>
      ) : null}

      <View style={styles.canvasCard}>{surface}</View>

      <View style={styles.tools}>
        <Button label="Desfazer" Icon={RotateCcw} variant="ghost" onPress={undo} disabled={empty || busy} />
        <Button label="Limpar" Icon={Trash2} variant="ghost" onPress={clear} disabled={empty || busy} />
      </View>

      {message ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button label="Cancelar" variant="secondary" onPress={onCancel} disabled={busy} style={styles.cancel} />
        <Button label={confirmLabel} Icon={Check} onPress={() => void save()} disabled={empty} loading={busy} style={styles.confirm} />
      </View>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: Colors.bg,
  paddingTop: 'env(safe-area-inset-top)',
  paddingBottom: 'env(safe-area-inset-bottom)',
};

const padBox: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

// Linha de base a ~72% da altura, como numa folha de assinatura.
const baseline: React.CSSProperties = {
  position: 'absolute',
  left: 20,
  right: 20,
  top: '72%',
  borderTop: `1.5px dashed ${Colors.textTertiary}`,
  pointerEvents: 'none',
};

const baselineMark: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  bottom: 6,
  fontFamily: FontFamily.semibold,
  fontSize: 15,
  color: Colors.textTertiary,
};

const placeholder: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '38%',
  textAlign: 'center',
  fontFamily: FontFamily.medium,
  fontSize: 15,
  color: Colors.textTertiary,
  pointerEvents: 'none',
  userSelect: 'none',
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  back: { backgroundColor: Colors.surface },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...Typography.heading, color: Colors.text },
  description: { ...Typography.caption, color: Colors.textSecondary },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface2,
  },
  currentLabel: { ...Typography.caption, color: Colors.textSecondary, fontFamily: FontFamily.semibold },
  currentImage: { flex: 1, height: 44 },
  canvasCard: {
    flex: 1,
    minHeight: 200,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  error: { marginHorizontal: Spacing.lg, marginTop: Spacing.xs, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.nokBg },
  errorText: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },
  footer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg },
  cancel: { flex: 2 },
  confirm: { flex: 3 },
  inline: { gap: Spacing.xs, padding: 6, borderRadius: Radius.xl, backgroundColor: Colors.bg },
  inlineCanvas: { height: 150, borderRadius: Radius.lg, backgroundColor: Colors.surface, overflow: 'hidden' },
});
