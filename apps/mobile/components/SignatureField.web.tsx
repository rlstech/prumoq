import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Colors, FontFamily, Palette } from '../lib/constants';

interface Props {
  visible: boolean;
  onSign: (dataUrl: string) => void;
  onCancel: () => void;
  /** Renderiza inline no fluxo da página em vez de sobrepor tela toda */
  inline?: boolean;
}

export function SignatureField({ visible, onSign, onCancel, inline = false }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null);

  if (!visible) return null;

  function handleConfirm() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSign(dataUrl);
  }

  if (inline) {
    return (
      <div style={inlineWrapper}>
        {/* Canvas inline */}
        <div style={inlineCanvas}>
          <SignatureCanvas
            ref={canvasRef}
            penColor={Colors.text}
            canvasProps={{ style: { width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' } }}
          />
        </div>
        {/* Toolbar */}
        <div style={inlineToolbar}>
          <span style={inlineHintText}>Assine com o dedo ou mouse</span>
          <button style={inlineBtnClear} onClick={() => canvasRef.current?.clear()}>
            Limpar
          </button>
        </div>
        {/* Confirm */}
        <button style={inlineBtnConfirm} onClick={handleConfirm}>
          ✓ Confirmar assinatura
        </button>
      </div>
    );
  }

  return (
    <div style={overlay}>
      {/* Header */}
      <div style={header}>
        <button style={backBtn} onClick={onCancel} title="Voltar ao formulário">
          ← Voltar
        </button>
        <span style={titleStyle}>Assinatura digital</span>
        <div style={{ width: 80 }} />
      </div>

      {/* Hint */}
      <div style={hint}>
        Assine com o dedo ou mouse na área abaixo
      </div>

      {/* Canvas */}
      <div style={canvasWrapper}>
        <SignatureCanvas
          ref={canvasRef}
          penColor={Colors.text}
          canvasProps={{ style: { width: '100%', height: '100%', touchAction: 'none' } }}
        />
      </div>

      {/* Footer */}
      <div style={footer}>
        <button
          style={{ ...btn, ...btnClear }}
          onClick={() => canvasRef.current?.clear()}
        >
          ↺ Limpar
        </button>
        <button
          style={{ ...btn, ...btnConfirm }}
          onClick={handleConfirm}
        >
          ✓ Salvar Assinatura
        </button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: Colors.surface,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  backgroundColor: Colors.bg,
};

const backBtn: React.CSSProperties = {
  background: Colors.surface,
  border: 'none',
  fontSize: 14,
  fontFamily: FontFamily.semibold,
  color: Colors.text,
  cursor: 'pointer',
  padding: '10px 16px',
  borderRadius: 9999,
  textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: 17,
  fontFamily: FontFamily.bold,
  color: Colors.text,
};

const hint: React.CSSProperties = {
  padding: '0 20px 12px',
  fontSize: 13,
  fontFamily: FontFamily.regular,
  color: Colors.textSecondary,
  backgroundColor: Colors.bg,
  textAlign: 'center',
};

const canvasWrapper: React.CSSProperties = {
  flex: 1,
  margin: '0 16px',
  borderRadius: 32,
  overflow: 'hidden',
  cursor: 'crosshair',
  backgroundColor: Colors.surface,
  position: 'relative',
};

const footer: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '16px',
  backgroundColor: Colors.bg,
  justifyContent: 'space-between',
};

const btn: React.CSSProperties = {
  minHeight: 56,
  padding: '0 24px',
  borderRadius: 9999,
  border: 'none',
  fontSize: 16,
  fontFamily: FontFamily.bold,
  cursor: 'pointer',
  flex: 1,
};

const btnClear: React.CSSProperties = {
  backgroundColor: Colors.surface2,
  color: Colors.text,
  flex: 0.4,
};

const btnConfirm: React.CSSProperties = {
  backgroundColor: Palette.accent,
  color: Palette.onAccent,
  flex: 0.6,
};

// ── Inline mode styles ───────────────────────────────────────────────────────
const inlineWrapper: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 24,
  overflow: 'hidden',
  padding: 6,
  backgroundColor: Colors.bg,
};

const inlineCanvas: React.CSSProperties = {
  height: 120,
  borderRadius: 20,
  overflow: 'hidden',
  backgroundColor: Colors.surface,
  cursor: 'crosshair',
  position: 'relative',
};

const inlineToolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '2px 10px',
};

const inlineHintText: React.CSSProperties = {
  fontSize: 12,
  fontFamily: FontFamily.regular,
  color: Colors.textSecondary,
};

const inlineBtnClear: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 13,
  fontFamily: FontFamily.semibold,
  color: Colors.nok,
  cursor: 'pointer',
  padding: '6px 8px',
};

const inlineBtnConfirm: React.CSSProperties = {
  width: '100%',
  minHeight: 52,
  backgroundColor: Palette.accent,
  border: 'none',
  borderRadius: 9999,
  fontSize: 15,
  fontFamily: FontFamily.bold,
  color: Palette.onAccent,
  cursor: 'pointer',
  textAlign: 'center',
};
