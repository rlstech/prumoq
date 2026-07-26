import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  normalizePdfImageSource,
  type PdfImageKind,
} from './pdf';

function bufferAsDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function dataUrlAsBuffer(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

async function normalizedMetadata(source: string, kind: PdfImageKind) {
  const normalized = await normalizePdfImageSource(source, kind);
  return {
    dataUrl: normalized,
    metadata: await sharp(dataUrlAsBuffer(normalized)).metadata(),
  };
}

test('normaliza fotos data URL para JPEG de até 1000 px', async () => {
  const source = await sharp({
    create: {
      width: 1800,
      height: 1200,
      channels: 4,
      background: { r: 30, g: 80, b: 120, alpha: 0.7 },
    },
  })
    .png()
    .toBuffer();

  const { dataUrl, metadata } = await normalizedMetadata(
    bufferAsDataUrl(source, 'image/png'),
    'photo',
  );

  assert.match(dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1000);
  assert.equal(metadata.height, 667);
  assert.equal(metadata.hasAlpha, false);
});

test('preserva assinatura como PNG sem ampliar a imagem', async () => {
  const source = await sharp({
    create: {
      width: 600,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  const { dataUrl, metadata } = await normalizedMetadata(
    bufferAsDataUrl(source, 'image/png'),
    'signature',
  );

  assert.match(dataUrl, /^data:image\/png;base64,/);
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 600);
  assert.equal(metadata.height, 180);
});

test('substitui origens blob por imagem de indisponibilidade', async () => {
  const normalized = await normalizePdfImageSource(
    'blob:https://prumoq.example/legacy-photo',
    'photo',
  );

  assert.match(normalized, /^data:image\/svg\+xml;base64,/);
});
