// Depois do `expo export`: escreve em dist/sw.js a lista de arquivos que o service worker guarda no
// aparelho e uma versão derivada do conteúdo (muda a cada build com alteração; força a atualização).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

// Fora da lista: o próprio service worker, metadados do export, mapas de código e as variantes do SQLite
// que o app não usa (o banco local usa OPFSCoopSyncVFS, build síncrona sem criptografia: ver
// lib/powersync.ts). Se algo fora da lista for pedido, o service worker guarda no primeiro uso.
const EXCLUIR = [
  /^sw\.js$/,
  /^metadata\.json$/,
  /\.map$/,
  /^powersync\/(assets\/)?mc-/,
  /^powersync\/(assets\/)?wa-sqlite-async/,
  /^powersync\/(AccessHandlePoolVFS|IDBBatchAtomicVFS|MemoryVFS|OPFSWriteAheadVFS)-/,
];

function listar(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? listar(caminho) : [caminho];
  });
}

const arquivos = listar(dist)
  .map((caminho) => relative(dist, caminho).split(sep).join('/'))
  .filter((rel) => !EXCLUIR.some((re) => re.test(rel)))
  .sort();

if (!arquivos.includes('index.html')) {
  console.error('[build-sw] dist/index.html não encontrado: rode o expo export antes.');
  process.exit(1);
}

// O modelo vem de public/sw.js (não de dist/), para o script poder rodar de novo sem duplicar o cabeçalho.
const template = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8');

const hash = createHash('sha256');
hash.update(template); // mudança só na lógica do service worker também gera versão nova
let bytes = 0;
for (const rel of arquivos) {
  const conteudo = readFileSync(join(dist, rel));
  bytes += conteudo.length;
  hash.update(rel).update('\0').update(conteudo);
}
const versao = hash.digest('hex').slice(0, 16);
// index.html é guardado como `/`: o servidor de arquivos do Worker redireciona /index.html para /, e uma
// resposta de redirecionamento não pode responder a uma navegação.
const urls = arquivos.map((rel) => (rel === 'index.html' ? '/' : encodeURI(`/${rel}`)));

const swPath = join(dist, 'sw.js');
writeFileSync(
  swPath,
  `self.__PRUMOQ_VERSION = ${JSON.stringify(versao)};\nself.__PRUMOQ_PRECACHE = ${JSON.stringify(urls, null, 0)};\n${template}`,
);
console.log(`[build-sw] versão ${versao}: ${arquivos.length} arquivos, ${(bytes / 1024 / 1024).toFixed(1)} MB guardados no aparelho.`);
