import { resolve } from 'node:path';
import sharp from 'sharp';

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error('Informe o caminho da prancha aprovada.');
}

const root = resolve(import.meta.dirname, '..');
const outputDir = resolve(root, 'apps/mobile/assets');
const crop = { left: 14, top: 37, width: 54, height: 54 };
const background = [248, 247, 243];
const navy = [9, 54, 77];
const lime = [216, 229, 104];

const { data, info } = await sharp(sourcePath)
  .extract(crop)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

function fitCoverage(pixel, foreground) {
  const direction = foreground.map((channel, index) => channel - background[index]);
  const offset = pixel.map((channel, index) => channel - background[index]);
  const denominator = direction.reduce((sum, channel) => sum + channel * channel, 0);
  const coverage = Math.max(
    0,
    Math.min(
      1,
      offset.reduce((sum, channel, index) => sum + channel * direction[index], 0) /
        denominator,
    ),
  );
  const error = pixel.reduce((sum, channel, index) => {
    const estimated = background[index] + coverage * direction[index];
    return sum + (channel - estimated) ** 2;
  }, 0);

  return { coverage, error };
}

function recolor(mainColor) {
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let index = 0; index < info.width * info.height; index += 1) {
    const sourceOffset = index * info.channels;
    const outputOffset = index * 4;
    const pixel = [
      data[sourceOffset],
      data[sourceOffset + 1],
      data[sourceOffset + 2],
    ];
    const navyFit = fitCoverage(pixel, navy);
    const limeFit = fitCoverage(pixel, lime);
    const isLime = limeFit.error < navyFit.error;
    const fit = isLime ? limeFit : navyFit;
    const color = isLime ? lime : mainColor;
    const alpha = fit.coverage < 0.08 ? 0 : Math.round(fit.coverage * 255);

    rgba[outputOffset] = color[0];
    rgba[outputOffset + 1] = color[1];
    rgba[outputOffset + 2] = color[2];
    rgba[outputOffset + 3] = alpha;
  }

  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(512, 512, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png();
}

await Promise.all([
  recolor(navy).toFile(resolve(outputDir, 'pq-monogram-default.png')),
  recolor([255, 254, 251]).toFile(resolve(outputDir, 'pq-monogram-on-brand.png')),
]);

console.log('Monograma extraído da opção B aprovada.');
