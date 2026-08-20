import { access } from 'node:fs/promises';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp from 'sharp';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_CHARS = Math.ceil(MAX_IMAGE_BYTES * 1.4);
const MAX_IMAGE_PIXELS = 40_000_000;
const IMAGE_CONCURRENCY = 4;
const REMOTE_IMAGE_TIMEOUT_MS = 8_000;

export type PdfImageKind = 'photo' | 'signature';

interface PreparedHtml {
  html: string;
  imageCount: number;
}

interface ImageReference {
  kind: PdfImageKind;
  source: string;
}

let browserPromise: Promise<Browser> | null = null;

function unavailableImageDataUrl(): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#F4F1E8"/><text x="50%" y="48%" text-anchor="middle" font-family="Arial" font-size="42" fill="#52615B">Imagem indisponível</text><text x="50%" y="56%" text-anchor="middle" font-family="Arial" font-size="24" fill="#6E7A75">Não foi possível carregar este anexo</text></svg>';
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function dataUrlAsBuffer(source: string): Buffer {
  const match = /^data:([^;,]+)?((?:;[^,]+)*?),([\s\S]*)$/.exec(source);
  if (!match) throw new Error('Data URL inválida.');

  const [, mime = '', attributes = '', payload] = match;
  if (payload.length > MAX_IMAGE_DATA_URL_CHARS) {
    throw new Error('Image exceeds the 20 MB limit.');
  }
  if (!mime.toLowerCase().startsWith('image/')) {
    throw new Error('Data URL must contain an image.');
  }
  const buffer = attributes.includes(';base64')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Imagem excede o limite de 20 MB.');
  }
  return buffer;
}

function allowedMediaHosts(): Set<string> {
  return new Set(
    (process.env.R2_ALLOWED_MEDIA_HOSTS ?? '')
      .split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAllowedRemoteMediaUrl(source: string): boolean {
  try {
    const url = new URL(source.replaceAll('&amp;', '&'));
    return url.protocol === 'https:' && allowedMediaHosts().has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function remoteImageAsBuffer(source: string): Promise<Buffer> {
  if (!isAllowedRemoteMediaUrl(source)) {
    throw new Error('Unauthorized image host.');
  }
  const response = await fetch(source.replaceAll('&amp;', '&'), {
    signal: AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS),
    cache: 'force-cache',
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('image/')) {
    throw new Error('Remote response is not an image.');
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds the 20 MB limit.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Imagem excede o limite de 20 MB.');
  }
  return buffer;
}

async function imageSourceAsBuffer(source: string): Promise<Buffer> {
  if (source.startsWith('data:')) return dataUrlAsBuffer(source);
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return remoteImageAsBuffer(source);
  }
  throw new Error('Origem de imagem não suportada.');
}

export async function normalizePdfImageSource(
  source: string,
  kind: PdfImageKind,
): Promise<string> {
  try {
    const input = await imageSourceAsBuffer(source);

    if (kind === 'signature') {
      const normalized = await sharp(input, { failOn: 'none', limitInputPixels: MAX_IMAGE_PIXELS })
        .rotate()
        .resize({
          width: 1000,
          height: 400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      return `data:image/png;base64,${normalized.toString('base64')}`;
    }

    const normalized = await sharp(input, { failOn: 'none', limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .flatten({ background: '#FFFFFF' })
      .resize({
        width: 1000,
        height: 1000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${normalized.toString('base64')}`;
  } catch (error) {
    console.warn('Anexo do relatório indisponível:', error);
    return unavailableImageDataUrl();
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => worker(),
    ),
  );
  return results;
}

function imageReferences(html: string): ImageReference[] {
  const references = new Map<string, ImageReference>();
  const imagePattern = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = imagePattern.exec(html)) !== null) {
    const tag = match[0];
    const source = match[1];
    const kindMatch = /\bdata-pdf-kind="(photo|signature)"/.exec(tag);
    const kind: PdfImageKind =
      kindMatch?.[1] === 'signature' ? 'signature' : 'photo';
    const key = `${kind}\u0000${source}`;
    references.set(key, { kind, source });
  }
  return Array.from(references.values());
}

async function inlineReportImages(html: string): Promise<PreparedHtml> {
  const references = imageReferences(html);
  if (!references.length) return { html, imageCount: 0 };

  const normalized = await mapWithConcurrency(
    references,
    IMAGE_CONCURRENCY,
    async (reference) => ({
      ...reference,
      dataUrl: await normalizePdfImageSource(
        reference.source,
        reference.kind,
      ),
    }),
  );
  const replacements = new Map(
    normalized.map(({ kind, source, dataUrl }) => [
      `${kind}\u0000${source}`,
      dataUrl,
    ]),
  );

  return {
    imageCount: references.length,
    html: html.replace(
      /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g,
      (tag, source: string) => {
        const kindMatch = /\bdata-pdf-kind="(photo|signature)"/.exec(tag);
        const kind: PdfImageKind =
          kindMatch?.[1] === 'signature' ? 'signature' : 'photo';
        const replacement = replacements.get(`${kind}\u0000${source}`);
        return replacement
          ? tag.replace(`src="${source}"`, `src="${replacement}"`)
          : tag;
      },
    ),
  };
}

async function firstExecutable(candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue procurando uma instalação disponível.
    }
  }
  return null;
}

async function chromiumExecutable(): Promise<string> {
  const executable = await firstExecutable([
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    process.env.PROGRAMFILES
      ? path.join(
          process.env.PROGRAMFILES,
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        )
      : undefined,
    process.env['PROGRAMFILES(X86)']
      ? path.join(
          process.env['PROGRAMFILES(X86)'],
          'Microsoft',
          'Edge',
          'Application',
          'msedge.exe',
        )
      : undefined,
  ]);

  if (!executable) {
    throw new Error(
      'Chromium não encontrado. Defina PUPPETEER_EXECUTABLE_PATH no ambiente.',
    );
  }
  return executable;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: await chromiumExecutable(),
        headless: true,
        timeout: 60_000,
        args:
          process.env.PUPPETEER_DISABLE_SANDBOX === 'true'
            ? ['--no-sandbox', '--disable-setuid-sandbox']
            : [],
      })
      .then((browser) => {
        browser.once('disconnected', () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }

  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

export async function closePdfBrowser(): Promise<void> {
  const currentBrowserPromise = browserPromise;
  browserPromise = null;
  if (!currentBrowserPromise) return;

  const browser = await currentBrowserPromise;
  if (browser.connected) await browser.close();
}

export async function createPdf(html: string): Promise<Uint8Array> {
  const totalStartedAt = performance.now();
  const imagesStartedAt = performance.now();
  const prepared = await inlineReportImages(html);
  const imagesDuration = performance.now() - imagesStartedAt;
  const browserStartedAt = performance.now();
  const browser = await getBrowser();
  const browserDuration = performance.now() - browserStartedAt;
  const page = await browser.newPage();

  try {
    await page.emulateMediaType('print');
    await page.setContent(prepared.html, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images, (image) =>
          image.decode().catch(() => undefined),
        ),
      );
    });

    const renderStartedAt = performance.now();
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const renderDuration = performance.now() - renderStartedAt;

    console.info('PDF FVS gerado', {
      browserMs: Math.round(browserDuration),
      images: prepared.imageCount,
      imagesMs: Math.round(imagesDuration),
      pdfBytes: pdf.byteLength,
      renderMs: Math.round(renderDuration),
      totalMs: Math.round(performance.now() - totalStartedAt),
    });
    return pdf;
  } finally {
    await page.close();
  }
}
