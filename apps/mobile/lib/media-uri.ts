/**
 * Classificação de referências de mídia.
 *
 * O app carrega dois tipos de referência no mesmo campo: chaves do R2
 * (`fotos/<cliente>/<user>/…`, que precisam de URL assinada) e caminhos locais
 * de arquivos que ainda não subiram. Confundir os dois quebra os dois lados —
 * uma chave tratada como local não renderiza, e um caminho local tratado como
 * chave vai parar no `r2-presign`, que responde `403 Invalid tenant media key`.
 *
 * Era esse o bug da foto sumindo: `usePhotoCapture` grava em
 * `FileSystem.documentDirectory`, produzindo `file:///data/user/0/…`, que não
 * casava com nenhum prefixo conhecido e caía no ramo remoto.
 */

/** Esquemas de arquivo local usados pelo Expo nas plataformas suportadas. */
const LOCAL_SCHEMES = [
  'file://',           // expo-file-system (Android e iOS)
  'content://',        // Storage Access Framework no Android
  'ph://',             // Photos framework no iOS
  'assets-library://',  // iOS legado
];

/** Já é exibível como está (URL remota assinada, data URL, blob do browser). */
const DIRECT_SCHEMES = ['http://', 'https://', 'data:', 'blob:'];

/** Prefixo de mídia capturada e ainda não enviada ao R2. */
export const PENDING_PREFIX = 'pending:';

/**
 * Devolve uma URI que o `<Image>` consegue exibir sem passar pelo servidor, ou
 * `null` quando o valor é uma chave do R2 que precisa ser assinada.
 */
export function localMediaUri(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;

  const raw = value.startsWith(PENDING_PREFIX) ? value.slice(PENDING_PREFIX.length) : value;
  if (!raw) return null;

  if (DIRECT_SCHEMES.some(scheme => raw.startsWith(scheme))) return raw;
  if (LOCAL_SCHEMES.some(scheme => raw.startsWith(scheme))) return raw;

  // Caminho absoluto do sistema de arquivos. Chaves do R2 nunca começam com
  // barra — são sempre relativas (`fotos/…`).
  if (raw.startsWith('/')) return raw;

  return null;
}

/**
 * `true` quando o valor é uma chave do R2 que exige URL assinada. Um valor
 * `pending:` nunca é: mesmo degenerado (sem caminho depois do prefixo) ele
 * descreve mídia local, e mandá-lo ao `r2-presign` só rende 403.
 */
export function isRemoteMediaKey(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  if (value.startsWith(PENDING_PREFIX)) return false;
  return localMediaUri(value) === null;
}
