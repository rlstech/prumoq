import { createEvidenceThumbnail } from './image-normalizer';
import { assinarUpload } from './media-api';
import { registrarEnvioMidia } from './media-upload';

// Envio de mídia do PWA: a referência local é uma `data:` URL (pending-media.web.ts). Sobe direto ao R2
// por URL assinada pelo Worker. Registrado ao importar este módulo (lib/auth/sessao.tsx).

/** Mesma frase que sync-failure.ts trata como definitiva: o arquivo não volta. */
const MEDIA_MISSING = 'O arquivo da foto não está mais no aparelho';
const TIPOS_ACEITOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function lerBlob(referencia: string): Promise<Blob> {
  // `blob:` de uma sessão anterior (dados gravados antes desta versão) não existe mais.
  if (!referencia.startsWith('data:') && !referencia.startsWith('blob:')) throw new Error(MEDIA_MISSING);
  try {
    const response = await fetch(referencia);
    if (!response.ok) throw new Error(MEDIA_MISSING);
    const blob = await response.blob();
    if (!blob.size) throw new Error(MEDIA_MISSING);
    return blob;
  } catch {
    throw new Error(MEDIA_MISSING);
  }
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao preparar a miniatura.'));
    reader.readAsDataURL(blob);
  });
}

function extensao(tipo: string): string {
  return tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
}

registrarEnvioMidia({
  async enviar(referencia, { campo, mimeType }) {
    const blob = await lerBlob(referencia);
    const contentType = TIPOS_ACEITOS.has(blob.type) ? blob.type : mimeType;
    const { uploadUrl, key } = await assinarUpload({
      filename: `${campo}_${Date.now()}.${extensao(contentType)}`,
      contentType,
      contentLength: blob.size,
    });
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
    if (!response.ok) throw new Error(`R2 upload failed: ${response.status}`);
    return key;
  },
  async miniatura(referencia) {
    await lerBlob(referencia); // a mesma checagem de "arquivo sumiu" do envio
    return blobParaDataUrl(await createEvidenceThumbnail(referencia));
  },
  // A referência é a própria linha local: some quando a versão do servidor chega pela sincronização.
  async descartar() {},
});
