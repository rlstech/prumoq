import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = '#163B50';
const masterPath = join(root, 'apps/mobile/assets/pq-monogram-on-brand.png');
const smallPath = masterPath;
const mobileAssets = join(root, 'apps/mobile/assets');
const mobilePublic = join(root, 'apps/mobile/public');

async function renderIcon({
  size,
  symbolScale,
  source = masterPath,
  background = brand,
  output,
}) {
  const symbolSize = Math.round(size * symbolScale);
  const offset = Math.round((size - symbolSize) / 2);
  const symbol = await sharp(source, { density: 600 })
    .resize(symbolSize, symbolSize, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: symbol, left: offset, top: offset }])
    .png()
    .toFile(output);
}

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

await Promise.all([
  renderIcon({
    size: 1024,
    symbolScale: 0.66,
    output: join(mobileAssets, 'icon.png'),
  }),
  renderIcon({
    size: 1024,
    symbolScale: 0.61,
    background: transparent,
    output: join(mobileAssets, 'adaptive-icon.png'),
  }),
  renderIcon({
    size: 64,
    symbolScale: 0.82,
    source: smallPath,
    output: join(mobileAssets, 'favicon.png'),
  }),
  renderIcon({
    size: 192,
    symbolScale: 0.66,
    output: join(mobilePublic, 'icon-192.png'),
  }),
  renderIcon({
    size: 512,
    symbolScale: 0.66,
    output: join(mobilePublic, 'icon-512.png'),
  }),
]);

const masterPng = await readFile(masterPath);
const symbolDataUrl = `data:image/png;base64,${masterPng.toString('base64')}`;

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2732" viewBox="0 0 2048 2732">
  <rect width="2048" height="2732" fill="${brand}"/>
  <image href="${symbolDataUrl}" x="664" y="850" width="720" height="720"/>
  <text x="1024" y="1765" fill="#FFFEFB" font-family="IBM Plex Sans, Arial, sans-serif" font-size="132" font-weight="700" text-anchor="middle" letter-spacing="-4">PrumoQ</text>
  <text x="1024" y="1860" fill="#D8E568" font-family="IBM Plex Sans, Arial, sans-serif" font-size="44" font-weight="600" text-anchor="middle" letter-spacing="8">QUALIDADE EM CAMPO</text>
</svg>
`;

const splashSvgPath = join(mobileAssets, 'splash.svg');
await writeFile(splashSvgPath, splashSvg, 'utf8');
await sharp(Buffer.from(splashSvg), { density: 144 })
  .resize(2048, 2732)
  .png()
  .toFile(join(mobileAssets, 'splash.png'));

console.log('PrumoQ brand assets generated.');
