import { File } from 'expo-file-system';
import type * as TextExtractor from 'expo-text-extractor';

import { isPdfRendererAvailable, renderPdfToImages } from '../../modules/pdf-renderer';

/*
 * On-device text recognition for lab reports. Apple Vision on iOS, Google ML Kit on Android, via
 * expo-text-extractor. Images are never uploaded: recognition runs on the phone, offline.
 *
 * The native module only exists in development/production builds made after expo-text-extractor
 * was added. It is loaded lazily so the rest of the app keeps working in an older build or on web,
 * and `isOcrAvailable()` lets the UI say why scanning is off instead of crashing.
 *
 * PDFs: neither engine reads PDFs directly, so a local native module (modules/pdf-renderer: PDFKit
 * on iOS, android.graphics.pdf.PdfRenderer on Android) first renders the pages to temporary JPEGs in
 * the cache directory. Each page is read like a photo, the text is combined in page order, and the
 * page images are deleted. Still entirely on the phone.
 */

/** Pages read from one PDF. Lab reports are short; this bounds the time a scan can take. */
const MAX_PDF_PAGES = 10;

let extractor: typeof TextExtractor | null | undefined;

function loadExtractor() {
  if (extractor !== undefined) return extractor;
  try {
    // Lazy so a build without the native module fails here, inside try, not at app start.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-text-extractor') as typeof TextExtractor;
    extractor = mod.isSupported ? mod : null;
  } catch {
    extractor = null;
  }
  return extractor;
}

export function isOcrAvailable() {
  return loadExtractor() != null;
}

export class OcrError extends Error {
  constructor(
    readonly reason: 'unavailable' | 'unsupported-file' | 'no-text' | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

export type OcrResult = {
  /** Text blocks in reading order, as returned by the engine. */
  blocks: string[];
  text: string;
};

/** Text recognition is unavailable in this build (no expo-text-extractor native module). */
function unavailable() {
  return new OcrError(
    'unavailable',
    'Text recognition isn’t available in this build of the app. Update the app to read lab reports.',
  );
}

function isPdf(source: { uri: string; mimeType?: string | null }) {
  return source.mimeType === 'application/pdf' || /\.pdf$/i.test(source.uri);
}

/** Runs the engine on one image and returns its non-empty text blocks. */
async function readImage(engine: typeof TextExtractor, uri: string): Promise<string[]> {
  let blocks: string[];
  try {
    blocks = await engine.extractTextFromImage(uri);
  } catch (e) {
    throw new OcrError('failed', e instanceof Error ? e.message : 'Could not read this image.');
  }
  return blocks.map((b) => b.trim()).filter(Boolean);
}

/** Error codes thrown by modules/pdf-renderer, mapped to messages for the patient. */
function pdfError(e: unknown): OcrError {
  const code = (e as { code?: string } | null)?.code;
  switch (code) {
    case 'ERR_PDF_PASSWORD':
      return new OcrError(
        'unsupported-file',
        'This PDF is password-protected. Open it, save a copy without the password, or take a photo of the report.',
      );
    case 'ERR_PDF_EMPTY':
      return new OcrError('no-text', 'This PDF has no pages to read.');
    case 'ERR_PDF_OPEN':
      return new OcrError('unsupported-file', 'This PDF couldn’t be opened. It may be damaged.');
    default:
      return new OcrError('failed', e instanceof Error ? e.message : 'Could not read this PDF.');
  }
}

/** Deletes rendered page images (and their folder). Never throws. */
function deletePages(uris: string[]) {
  for (const uri of uris) {
    try {
      new File(uri).delete();
    } catch {
      // Already gone; the native module also prunes old renders.
    }
  }
  try {
    if (uris.length) {
      const folder = new File(uris[0]).parentDirectory;
      if (folder.exists) folder.delete();
    }
  } catch {
    // Ignore; see above.
  }
}

/** Renders a PDF's pages to images and reads them in page order. */
async function readPdf(engine: typeof TextExtractor, uri: string): Promise<string[]> {
  if (!isPdfRendererAvailable()) {
    throw new OcrError(
      'unavailable',
      'Reading PDFs needs the latest version of the app. For now, take a photo or a screenshot of the report.',
    );
  }
  let pages: string[] = [];
  try {
    try {
      pages = (await renderPdfToImages(uri, { maxPages: MAX_PDF_PAGES })).uris;
    } catch (e) {
      throw pdfError(e);
    }
    const blocks: string[] = [];
    // One page at a time: OCR engines are memory-hungry and the pages are large images.
    for (const page of pages) {
      blocks.push(...(await readImage(engine, page)));
    }
    return blocks;
  } finally {
    // The page images are copies of a medical document; never leave them in the cache.
    deletePages(pages);
  }
}

/**
 * Recognizes the text in a local image or PDF (file:// URI; content:// also works for PDFs on
 * Android). For a PDF, the first pages (MAX_PDF_PAGES) are read and combined in page order.
 * Throws OcrError with a user-facing message.
 */
export async function recognizeText(source: { uri: string; mimeType?: string | null }): Promise<OcrResult> {
  const engine = loadExtractor();
  if (!engine) throw unavailable();

  const pdf = isPdf(source);
  const blocks = pdf ? await readPdf(engine, source.uri) : await readImage(engine, source.uri);
  if (!blocks.length) {
    throw new OcrError(
      'no-text',
      pdf
        ? 'No text was found in this PDF. If it is a scan, try a photo of the page instead.'
        : 'No text was found. Try a sharper, well-lit photo of the whole page.',
    );
  }
  return { blocks, text: blocks.join('\n') };
}
