/**
 * Versão do app que está rodando: "1.0.0 · a530eef9 · 21/10/2026, 14:05" (versão do package.json, código do
 * build — o mesmo que o service worker usa para atualizar — e data do build). Gravada no index.html por
 * scripts/build-sw.mjs. No servidor de desenvolvimento não existe.
 */
export function versaoDoApp(): string {
  if (typeof document === 'undefined') return 'desenvolvimento';
  const meta = document.querySelector('meta[name="prumoq-versao"]');
  return meta?.getAttribute('content') || 'desenvolvimento';
}
