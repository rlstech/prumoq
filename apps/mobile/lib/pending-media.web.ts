// Web stub — no PWA não existe filesystem local: a mídia pendente é um
// `blob:`/`data:` URL que o shim resolve direto no upload para o R2, e nenhum
// diretório é apagado no meio do caminho. Metro resolve este arquivo no lugar
// de pending-media.ts quando platform === 'web'.
export const PENDING_MEDIA_DIRECTORY = '';

export async function storePendingMedia(uri: string): Promise<string> {
  return uri;
}

export async function adoptPendingMedia(uri: string): Promise<string> {
  return uri;
}
