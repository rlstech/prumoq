import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = '#163B50';
const masterPath = join(root, 'packages/design-system/assets/prumoq-symbol.svg');
const smallPath = join(root, 'packages/design-system/assets/prumoq-symbol-small.svg');
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

const masterSvg = await readFile(masterPath, 'utf8');
const symbolBody = masterSvg
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '');

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2732" viewBox="0 0 2048 2732">
  <rect width="2048" height="2732" fill="${brand}"/>
  <g transform="translate(664 850) scale(11.25)">
    ${symbolBody.trim()}
  </g>
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
