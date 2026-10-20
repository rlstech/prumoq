/**
 * Mídia pendente no navegador: guardada como `data:` URL na própria linha do banco local.
 *
 * Um `blob:` some ao recarregar a página, e a foto se perdia antes de subir. A `data:` URL vive no SQLite
 * local (persistente, OPFS) junto com a linha, é exibida direto pelas telas e é trocada pela chave do R2
 * quando o connector envia a linha. As fotos já chegam reduzidas (image-normalizer.web.ts).
 */
export const PENDING_MEDIA_DIRECTORY = '';

async function paraDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  let blob: Blob;
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(String(response.status));
    blob = await response.blob();
  } catch {
    throw new Error('Não foi possível ler a foto ou assinatura. Capture-a novamente.');
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao preparar a mídia.'));
    reader.readAsDataURL(blob);
  });
}

export async function storePendingMedia(uri: string): Promise<string> {
  return paraDataUrl(uri);
}

export async function adoptPendingMedia(uri: string): Promise<string> {
  return paraDataUrl(uri);
}

/** Nome de arquivo para gravar junto da foto (`nome_arquivo`). */
export function nomeArquivoMidia(referencia: string, prefixo = 'foto'): string {
  const tipo = referencia.match(/^data:image\/(\w+)/)?.[1];
  if (tipo) return `${prefixo}_${Date.now()}.${tipo === 'jpeg' ? 'jpg' : tipo}`;
  return referencia.split('/').pop() || `${prefixo}.jpg`;
}
