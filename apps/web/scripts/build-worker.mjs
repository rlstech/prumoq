// Build do admin para o Cloudflare Workers (OpenNext).
//
// O OpenNext copia o conteúdo dos arquivos .env* para .open-next/cloudflare/next-env.mjs, ou seja, para dentro
// do Worker publicado. Isso incluiria CLERK_SECRET_KEY e as chaves do R2 do .env.local. Este script deixa nesse
// arquivo só as variáveis NEXT_PUBLIC_* (que já são públicas: vão no JavaScript do navegador) e, no fim, procura
// no pacote qualquer valor não público dos .env*; se achar, falha. Segredos de produção: `wrangler secret put`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(appDir, 'package.json'));
const run = (script, args) => execFileSync(process.execPath, [script, ...args], { stdio: 'inherit', cwd: appDir });

// 1. Next.js (o OpenNext chamaria `pnpm build`, que nem sempre está no PATH)
run(require.resolve('next/dist/bin/next'), ['build']);

// 2. OpenNext, reaproveitando o build acima
// O pacote não exporta ./package.json: parte da entrada principal (dist/api/index.js) até dist/cli.
run(join(dirname(require.resolve('@opennextjs/cloudflare')), '..', 'cli', 'index.js'), ['build', '--skipNextBuild']);

// 3. Só variáveis públicas no next-env.mjs
const envModule = join(appDir, '.open-next', 'cloudflare', 'next-env.mjs');
const source = readFileSync(envModule, 'utf8');
const filtered = source.replace(/^export const (\w+) = (\{.*\});$/gm, (_line, name, json) => {
  const values = JSON.parse(json);
  const publicOnly = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('NEXT_PUBLIC_')));
  return `export const ${name} = ${JSON.stringify(publicOnly)};`;
});
writeFileSync(envModule, filtered);

// 4. Nenhum valor não público dos .env* pode estar no pacote
const secrets = new Set();
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const path = join(appDir, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(line);
    // valores curtos (ex.: nome do bucket) não são segredo e dariam falso positivo
    if (match && !match[1].startsWith('NEXT_PUBLIC_') && match[2].length >= 16) secrets.add(match[2]);
  }
}
const leaks = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    const content = readFileSync(path, 'latin1');
    for (const secret of secrets) if (content.includes(secret)) leaks.push(path);
  }
};
walk(join(appDir, '.open-next'));
if (leaks.length) {
  console.error(`[build-worker] valor secreto encontrado no pacote do Worker:\n${[...new Set(leaks)].join('\n')}`);
  process.exit(1);
}
console.log(`[build-worker] ok: next-env.mjs só com NEXT_PUBLIC_*; ${secrets.size} segredo(s) do .env conferido(s), nenhum no pacote.`);
