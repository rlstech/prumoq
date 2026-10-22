/**
 * Gera os ícones do PWA com o símbolo "Q de face" a partir da MESMA geometria de
 * `faceSymbolGeometry` (packages/design-system), numa grade de 64 unidades.
 * Os valores estão repetidos aqui porque este script roda em node puro, sem
 * passar pelo TypeScript do workspace; se a geometria mudar lá, atualize aqui.
 *
 * Rode depois de qualquer mudança na marca (na raiz: `corepack pnpm brand:assets`):
 *   node apps/mobile/scripts/generate-brand-assets.mjs
 *
 * Sem dependências: rasteriza com supersampling 4×4 e escreve PNG via zlib.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(HERE, '..');

const GRAPHITE = [0x1c, 0x1f, 0x22];
const YELLOW = [0xff, 0xc2, 0x1a];
const WHITE = [0xff, 0xff, 0xff];

// faceSymbolGeometry
const RING = { cx: 25, cy: 23, r: 15, half: 3.5 };
const CORD_TOP = { x: 38, top: 33, bottom: 39, half: 1.3 };
const TACO = { x: 30.5, y: 38.5, w: 15, h: 6.5, r: 2.4 };
const CORD_BOTTOM = { x: 38, top: 45, bottom: 48, half: 1.3 };
const WEIGHT = { x: 30.5, y: 48, w: 15, h: 13.5, r: 2 };
const RIBS = { y: [52.5, 57], half: 0.55 };
/** Caixa desenhada: (6.5, 4.5) a (45.5, 61.5); centro (26, 33). */
const BOUNDS = { left: 6.5, right: 45.5, top: 4.5, bottom: 61.5 };
const GLYPH_HEIGHT_UNITS = BOUNDS.bottom - BOUNDS.top;
const CENTER_X = (BOUNDS.left + BOUNDS.right) / 2;
const CENTER_Y = (BOUNDS.top + BOUNDS.bottom) / 2;
const SAMPLES = 4;
/** Frisos do peso só quando cada unidade da grade tem ao menos 3 px. */
const RIBS_MIN_SCALE = 3;

/** Retângulo com cantos arredondados (só os de baixo, se bottomOnly). */
function inRoundRect(x, y, { x: rx, y: ry, w, h, r }, bottomOnly = false) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const top = bottomOnly ? ry : ry + r;
  const cy = Math.min(Math.max(y, top), ry + h - r);
  if (bottomOnly && y < ry + h - r) return true;
  return Math.hypot(x - cx, y - cy) <= r;
}

function coverage(px, py, scale, offsetX, offsetY) {
  let ink = 0;
  let weight = 0;
  let rib = 0;
  const ribs = scale >= RIBS_MIN_SCALE;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const gx = (px + (sx + 0.5) / SAMPLES - offsetX) / scale;
      const gy = (py + (sy + 0.5) / SAMPLES - offsetY) / scale;
      const inCord =
        (Math.abs(gx - CORD_TOP.x) <= CORD_TOP.half && gy >= CORD_TOP.top && gy <= CORD_TOP.bottom) ||
        (Math.abs(gx - CORD_BOTTOM.x) <= CORD_BOTTOM.half && gy >= CORD_BOTTOM.top && gy <= CORD_BOTTOM.bottom);
      if (inRoundRect(gx, gy, WEIGHT, true)) {
        if (ribs && RIBS.y.some((y) => Math.abs(gy - y) <= RIBS.half)) rib++;
        else weight++;
      } else if (
        Math.abs(Math.hypot(gx - RING.cx, gy - RING.cy) - RING.r) <= RING.half ||
        inCord ||
        inRoundRect(gx, gy, TACO)
      ) {
        ink++;
      }
    }
  }
  const total = SAMPLES * SAMPLES;
  return { ink: ink / total, weight: weight / total, rib: rib / total };
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

function render({ width, height, background, glyphHeight, inkColor }) {
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
  const offsetX = width / 2 - CENTER_X * scale;
  const offsetY = height / 2 - CENTER_Y * scale;

  // Só varre a caixa da marca; o resto é fundo puro.
  const x0 = Math.max(0, Math.floor(offsetX + BOUNDS.left * scale) - 2);
  const x1 = Math.min(width, Math.ceil(offsetX + BOUNDS.right * scale) + 2);
  const y0 = Math.max(0, Math.floor(offsetY + BOUNDS.top * scale) - 2);
  const y1 = Math.min(height, Math.ceil(offsetY + BOUNDS.bottom * scale) + 2);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const { ink, weight, rib } = coverage(x, y, scale, offsetX, offsetY);
      if (ink === 0 && weight === 0 && rib === 0) continue;
      const i = (y * width + x) * 4;
      blend(rgba, i, inkColor, ink);
      blend(rgba, i, YELLOW, weight);
      blend(rgba, i, GRAPHITE, rib);
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

const onGraphite = { inkColor: WHITE };

const targets = [
  // Ícone cheio: sangra até a borda, a máscara do sistema arredonda.
  { file: 'assets/icon.png', width: 1024, height: 1024, background: GRAPHITE, glyphHeight: 600, ...onGraphite },
  // Android adaptativo: fundo vem do app.json; a marca fica no círculo seguro (66%).
  { file: 'assets/adaptive-icon.png', width: 1024, height: 1024, background: null, glyphHeight: 540, ...onGraphite },
  { file: 'assets/favicon.png', width: 64, height: 64, background: GRAPHITE, glyphHeight: 52, ...onGraphite },
  { file: 'assets/splash.png', width: 2048, height: 2732, background: GRAPHITE, glyphHeight: 520, ...onGraphite },
  // PWA "any maskable": a marca inteira cabe no círculo de 80% do centro.
  { file: 'public/icon-192.png', width: 192, height: 192, background: GRAPHITE, glyphHeight: 116, ...onGraphite },
  { file: 'public/icon-512.png', width: 512, height: 512, background: GRAPHITE, glyphHeight: 310, ...onGraphite },
];

for (const target of targets) {
  const rgba = render(target);
  const png = encodePng(target.width, target.height, rgba);
  const out = resolve(MOBILE, target.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log(`${target.file} — ${target.width}×${target.height}, ${(png.length / 1024).toFixed(1)} KB`);
}
