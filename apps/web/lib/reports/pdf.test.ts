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

test('não faz requisições para URLs remotas fora da allowlist de R2', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('fetch não deveria ser chamado');
  };

  try {
    const normalized = await normalizePdfImageSource(
      'http://127.0.0.1:5432/internal',
      'photo',
    );
    assert.match(normalized, /^data:image\/svg\+xml;base64,/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('baixa fotos assinadas do endpoint R2 mesmo sem R2_ALLOWED_MEDIA_HOSTS', async () => {
  const photo = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 200, g: 120, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();

  const originalFetch = globalThis.fetch;
  const originalHosts = process.env.R2_ALLOWED_MEDIA_HOSTS;
  delete process.env.R2_ALLOWED_MEDIA_HOSTS;

  let requestedUrl: string | null = null;
  globalThis.fetch = (async (input: string) => {
    requestedUrl = input;
    return new Response(new Uint8Array(photo), {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'content-length': String(photo.byteLength),
      },
    });
  }) as typeof globalThis.fetch;

  try {
    const normalized = await normalizePdfImageSource(
      'https://acct123.r2.cloudflarestorage.com/prumoq-fotos/fotos/a/b/2026/08/foto.jpg?X-Amz-Signature=abc',
      'photo',
    );

    assert.match(normalized, /^data:image\/jpeg;base64,/);
    assert.equal(
      requestedUrl,
      'https://acct123.r2.cloudflarestorage.com/prumoq-fotos/fotos/a/b/2026/08/foto.jpg?X-Amz-Signature=abc',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalHosts === undefined) delete process.env.R2_ALLOWED_MEDIA_HOSTS;
    else process.env.R2_ALLOWED_MEDIA_HOSTS = originalHosts;
  }
});

test('bloqueia host que apenas termina parecido com o endpoint R2', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('fetch não deveria ser chamado');
  };

  try {
    const normalized = await normalizePdfImageSource(
      'https://evilr2.cloudflarestorage.com/payload.jpg',
      'photo',
    );
    assert.match(normalized, /^data:image\/svg\+xml;base64,/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
