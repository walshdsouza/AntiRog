import type * as TextExtractor from 'expo-text-extractor';

/*
 * On-device text recognition for lab reports. Apple Vision on iOS, Google ML Kit on Android, via
 * expo-text-extractor. Images are never uploaded: recognition runs on the phone, offline.
 *
 * The native module only exists in development/production builds made after expo-text-extractor
 * was added. It is loaded lazily so the rest of the app keeps working in an older build or on web,
 * and `isOcrAvailable()` lets the UI say why scanning is off instead of crashing.
 *
 * PDFs: neither engine reads PDFs directly. Rendering PDF pages to images (PDFKit on iOS,
 * PdfRenderer on Android) needs a small native module and is the next step; until then PDFs are
 * rejected with a clear message.
 */

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

/** Recognizes the text in a local image (file:// URI). Throws OcrError with a user-facing message. */
export async function recognizeText(source: { uri: string; mimeType?: string | null }): Promise<OcrResult> {
  if (source.mimeType === 'application/pdf' || /\.pdf$/i.test(source.uri)) {
    throw new OcrError(
      'unsupported-file',
      'Reading values from PDFs is coming soon. For now, take a photo or a screenshot of the report.',
    );
  }
  const engine = loadExtractor();
  if (!engine) {
    throw new OcrError(
      'unavailable',
      'Text recognition isn’t available in this build of the app. Update the app to read lab reports.',
    );
  }
  let blocks: string[];
  try {
    blocks = await engine.extractTextFromImage(source.uri);
  } catch (e) {
    throw new OcrError('failed', e instanceof Error ? e.message : 'Could not read this image.');
  }
  blocks = blocks.map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) {
    throw new OcrError('no-text', 'No text was found. Try a sharper, well-lit photo of the whole page.');
  }
  return { blocks, text: blocks.join('\n') };
}
