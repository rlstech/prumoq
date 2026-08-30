/**
 * Gera os ícones da marca PrumoQ a partir da MESMA geometria de
 * `prumoSymbolGeometry` (packages/design-system) — grade de 32 unidades, anel
 * de raio 6 centrado em (16, 13.2), fio até 23.4 e peso entre 23.2 e 28.7.
 * Os valores estão repetidos aqui porque este script roda em node puro, sem
 * passar pelo TypeScript do workspace; se a geometria mudar lá, atualize aqui.
 *
 * Rode depois de qualquer mudança na marca:
 *   node scripts/generate-brand-assets.mjs
 *
 * Sem dependências: rasteriza com supersampling 4×4 e escreve PNG via zlib.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(HERE, '..');

const PLUMB = [0x16, 0x3b, 0x50];
const LIME = [0xd8, 0xe5, 0x68];
const WHITE = [0xff, 0xff, 0xff];

/** Caixa visual da marca dentro da grade de 32: o anel começa em y=6.15 e o
 *  peso termina em 28.7, então o centro óptico não é 16 — é 17.425. */
const GLYPH_HEIGHT_UNITS = 22.55;
const GLYPH_CENTER_Y = 17.425;
const SAMPLES = 4;

function coverage(px, py, scale, offsetX, offsetY) {
  let ring = 0;
  let line = 0;
  let bob = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const gx = (px + (sx + 0.5) / SAMPLES - offsetX) / scale;
      const gy = (py + (sy + 0.5) / SAMPLES - offsetY) / scale;
      const r = Math.hypot(gx - 16, gy - 13.2);
      if (Math.abs(r - 6) <= 1.05) ring++;
      if (Math.abs(gx - 16) <= 0.85 && gy >= 19.2 && gy <= 23.4) line++;
      if (Math.abs(gx - 16) / 2.3 + Math.abs(gy - 25.95) / 2.75 <= 1) bob++;
    }
  }
  const total = SAMPLES * SAMPLES;
  return { ring: ring / total, line: line / total, bob: bob / total };
}

function blend(dst, i, color, alpha) {
  if (alpha <= 0) return;
  const a = Math.min(1, alpha);
  const da = dst[i + 3] / 255;
  const outA = a + da * (1 - a);
  for (let c = 0; c < 3; c++) {
    const src = color[c] * a;
    const back = dst[i + c] * da * (1 - a);
    dst[i + c] = outA === 0 ? 0 : Math.round((src + back) / outA);
  }
  dst[i + 3] = Math.round(outA * 255);
}

function render({ width, height, background, glyphHeight, ringColor, lineColor, bobColor }) {
  const rgba = Buffer.alloc(width * height * 4);
  if (background) {
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = background[0];
      rgba[i + 1] = background[1];
      rgba[i + 2] = background[2];
      rgba[i + 3] = 255;
    }
  }

  const scale = glyphHeight / GLYPH_HEIGHT_UNITS;
  const offsetX = width / 2 - 16 * scale;
  const offsetY = height / 2 - GLYPH_CENTER_Y * scale;

  // Só varre a caixa da marca — o resto da tela é fundo puro.
  const x0 = Math.max(0, Math.floor(offsetX + 8.5 * scale) - 2);
  const x1 = Math.min(width, Math.ceil(offsetX + 23.5 * scale) + 2);
  const y0 = Math.max(0, Math.floor(offsetY + 5.8 * scale) - 2);
  const y1 = Math.min(height, Math.ceil(offsetY + 29.1 * scale) + 2);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const { ring, line, bob } = coverage(x, y, scale, offsetX, offsetY);
      if (ring === 0 && line === 0 && bob === 0) continue;
      const i = (y * width + x) * 4;
      blend(rgba, i, ringColor, ring);
      blend(rgba, i, lineColor, line);
      blend(rgba, i, bobColor, bob);
    }
  }
  return rgba;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const onPlumb = { ringColor: WHITE, lineColor: LIME, bobColor: LIME };

const targets = [
  // iOS/loja: sangra até a borda, a máscara do sistema arredonda.
  { file: 'assets/icon.png', width: 1024, height: 1024, background: PLUMB, glyphHeight: 512, ...onPlumb },
  // Android adaptativo: fundo vem do app.json, a marca fica na zona segura.
  { file: 'assets/adaptive-icon.png', width: 1024, height: 1024, background: null, glyphHeight: 410, ...onPlumb },
  { file: 'assets/favicon.png', width: 64, height: 64, background: PLUMB, glyphHeight: 36, ...onPlumb },
  { file: 'assets/splash.png', width: 2048, height: 2732, background: PLUMB, glyphHeight: 420, ...onPlumb },
  // PWA "any maskable": conteúdo dentro dos 80% centrais.
  { file: 'public/icon-192.png', width: 192, height: 192, background: PLUMB, glyphHeight: 80, ...onPlumb },
  { file: 'public/icon-512.png', width: 512, height: 512, background: PLUMB, glyphHeight: 214, ...onPlumb },
];

for (const target of targets) {
  const rgba = render(target);
  const png = encodePng(target.width, target.height, rgba);
  const out = resolve(MOBILE, target.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log(`${target.file} — ${target.width}×${target.height}, ${(png.length / 1024).toFixed(1)} KB`);
}
