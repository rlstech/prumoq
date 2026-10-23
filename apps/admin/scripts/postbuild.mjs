// Depois do `vite build` (saída em dist/admin, servida em /admin):
// - dist/index.html: o fallback de SPA do Cloudflare entrega /index.html para qualquer caminho sem arquivo
//   (ex.: /admin/obras/123); é o mesmo index do painel, com os assets apontando para /admin/assets.
// - dist/_headers: cabeçalhos de segurança e cache (arquivo _headers na raiz do app).
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
copyFileSync(join(root, 'dist', 'admin', 'index.html'), join(root, 'dist', 'index.html'));
copyFileSync(join(root, '_headers'), join(root, 'dist', '_headers'));
console.log('[postbuild] dist/index.html e dist/_headers prontos.');
