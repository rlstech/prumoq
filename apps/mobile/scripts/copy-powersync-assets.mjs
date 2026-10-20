// Copia os workers e o wasm do @powersync/web para public/powersync (servidos na raiz do PWA).
// O CLI grava em public/@powersync; a pasta é renomeada porque o servidor de arquivos do Cloudflare
// redireciona `/@...` para `/%40...`, e um redirecionamento no script do worker atrapalha o cache offline.
// Os .map ficam de fora: só pesam no download e não são usados em produção.
import { execFileSync } from 'node:child_process';
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const saidaCli = join(publicDir, '@powersync');
const target = join(publicDir, 'powersync');
const require = createRequire(import.meta.url);
// O pacote não exporta ./package.json: parte da entrada principal (lib/index.js) até a raiz.
const cli = join(dirname(require.resolve('@powersync/web', { paths: [here] })), '..', 'bin', 'powersync.cjs');

rmSync(saidaCli, { recursive: true, force: true });
rmSync(target, { recursive: true, force: true });
// O CLI só aceita caminho relativo em -o (com absoluto no Windows ele concatena com o cwd).
execFileSync(process.execPath, [cli, 'copy-assets', '-o', 'public'], { stdio: 'inherit', cwd: join(here, '..') });
renameSync(saidaCli, target);

const walk = (dir) => readdirSync(dir).forEach((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) walk(path);
  else if (name.endsWith('.map')) rmSync(path);
});
walk(target);
