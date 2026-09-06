import * as FileSystem from 'expo-file-system';
import { uuid } from './uuid';

/**
 * Onde a mídia vive enquanto a fila do PowerSync não confirma a linha.
 *
 * `documentDirectory` sobrevive a reinício e a limpeza de cache do sistema, e
 * só o connector apaga daqui — depois que o servidor aceita a linha que
 * referencia o arquivo (ver `confirmedMedia` em supabase-connector.ts).
 */
export const PENDING_MEDIA_DIRECTORY = `${FileSystem.documentDirectory}prumoq-pending-media/`;

/**
 * Copia `uri` para o diretório de pendências e devolve o novo caminho.
 *
 * O `prefix` sobrevive no `nome_arquivo` das fotos (`caminho.split('/').pop()`),
 * então vale manter o mesmo que cada tela já usava.
 */
export async function storePendingMedia(
  uri: string,
  prefix = 'photo',
  extension = 'jpg',
): Promise<string> {
  await FileSystem.makeDirectoryAsync(PENDING_MEDIA_DIRECTORY, { intermediates: true });
  const dest = `${PENDING_MEDIA_DIRECTORY}${prefix}_${uuid()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

/**
 * Garante que o caminho gravado no banco esteja sob o controle do connector.
 *
 * Um rascunho restaurado devolve caminhos dentro de `prumoq-drafts/<draftId>/`,
 * e o `handleSave` descarta esse diretório assim que grava as linhas — antes de
 * a fila drenar. O arquivo sumia e a operação ia para a quarentena. Adotando a
 * mídia antes de gravar, a linha passa a apontar para `prumoq-pending-media/`,
 * que ninguém além do connector apaga; o descarte do rascunho remove apenas as
 * cópias dele.
 *
 * No-op quando o caminho já está no diretório de pendências.
 */
export async function adoptPendingMedia(uri: string): Promise<string> {
  if (uri.startsWith(PENDING_MEDIA_DIRECTORY)) return uri;
  return storePendingMedia(uri, 'photo', uri.toLowerCase().endsWith('.png') ? 'png' : 'jpg');
}
