import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface Props {
  visible: boolean;
  onSign: (dataUrl: string) => void;
  onCancel: () => void;
}

export function SignatureField({ visible, onSign, onCancel }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null);

  if (!visible) return null;

  function handleConfirm() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      onCancel();
      return;
    }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSign(dataUrl);
  }

  return (
    <div style={overlay}>
      <div style={header}>
        <span style={titleStyle}>Assine aqui</span>
      </div>
      <div style={canvasWrapper}>
        <SignatureCanvas
          ref={canvasRef}
          penColor="#1a1a1a"
          canvasProps={{ style: { width: '100%', height: '100%', touchAction: 'none' } }}
        />
      </div>
      <div style={footer}>
        <button style={{ ...btn, ...btnSecondary }} onClick={() => canvasRef.current?.clear()}>
          Limpar
        </button>
        <button style={{ ...btn, ...btnCancel }} onClick={onCancel}>
          Cancelar
        </button>
        <button style={{ ...btn, ...btnConfirm }} onClick={handleConfirm}>
          Confirmar
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
  padding: '12px 16px',
  borderBottom: '1px solid #e0e0e0',
  backgroundColor: '#f5f5f5',
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#333',
};

const canvasWrapper: React.CSSProperties = {
  flex: 1,
  borderBottom: '1px solid #e0e0e0',
  cursor: 'crosshair',
  backgroundColor: '#fafafa',
};

const footer: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '12px 16px',
  backgroundColor: '#f5f5f5',
  justifyContent: 'flex-end',
};

const btn: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  border: 'none',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = { backgroundColor: '#e0e0e0', color: '#333', marginRight: 'auto' };
const btnCancel: React.CSSProperties = { backgroundColor: '#fce4ec', color: '#c62828' };
const btnConfirm: React.CSSProperties = { backgroundColor: '#E84A1A', color: '#fff' };
