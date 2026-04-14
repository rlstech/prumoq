import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

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
            penColor="#1a1a1a"
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
        <span style={titleStyle}>Assinatura Digital</span>
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
          penColor="#1a1a1a"
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
  backgroundColor: '#fff',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #e0e0e0',
  backgroundColor: '#f5f5f5',
};

const backBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 14,
  fontWeight: 500,
  color: '#E84A1A',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 6,
  width: 80,
  textAlign: 'left',
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#1a1a1a',
};

const hint: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 12,
  color: '#888',
  backgroundColor: '#fafafa',
  borderBottom: '1px solid #efefef',
  textAlign: 'center',
};

const canvasWrapper: React.CSSProperties = {
  flex: 1,
  borderBottom: '1px solid #e0e0e0',
  cursor: 'crosshair',
  backgroundColor: '#fff',
  position: 'relative',
};

const footer: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '14px 16px',
  backgroundColor: '#f5f5f5',
  justifyContent: 'space-between',
};

const btn: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: 10,
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  flex: 1,
};

const btnClear: React.CSSProperties = {
  backgroundColor: '#e8e8e8',
  color: '#444',
  flex: 0.4,
};

const btnConfirm: React.CSSProperties = {
  backgroundColor: '#E84A1A',
  color: '#fff',
  flex: 0.6,
};

// ── Inline mode styles ───────────────────────────────────────────────────────
const inlineWrapper: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  borderRadius: 8,
  overflow: 'hidden',
  border: '0.5px solid rgba(0,0,0,0.12)',
  backgroundColor: '#fff',
};

const inlineCanvas: React.CSSProperties = {
  height: 110,
  backgroundColor: '#fff',
  cursor: 'crosshair',
  position: 'relative',
};

const inlineToolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#F1EFE8',
  padding: '7px 12px',
  borderTop: '0.5px solid rgba(0,0,0,0.08)',
};

const inlineHintText: React.CSSProperties = {
  fontSize: 11,
  color: '#9C9A93',
};

const inlineBtnClear: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 12,
  color: '#C62828',
  cursor: 'pointer',
  fontWeight: 500,
  padding: '2px 4px',
};

const inlineBtnConfirm: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  backgroundColor: '#F1EFE8',
  border: 'none',
  borderTop: '0.5px solid rgba(0,0,0,0.08)',
  fontSize: 13,
  fontWeight: 600,
  color: '#1A1A18',
  cursor: 'pointer',
  textAlign: 'center',
};
