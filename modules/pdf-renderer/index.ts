import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/*
 * Local Expo module (modules/pdf-renderer): renders the pages of a local PDF to JPEG files in the
 * cache directory, on the device (PDFKit on iOS, android.graphics.pdf.PdfRenderer on Android), so
 * they can be fed to on-device OCR.
 *
 * Errors carry a `code`: ERR_PDF_OPEN, ERR_PDF_PASSWORD, ERR_PDF_EMPTY or ERR_PDF_RENDER.
 */

export type RenderToImagesOptions = {
  /** Pages after this are skipped. Default 10. */
  maxPages?: number;
  /** Output width in pixels (500–4000). Default 2000, which keeps small print legible for OCR. */
  width?: number;
  /** JPEG quality, 0–1. Default 0.9. */
  quality?: number;
};

export type RenderToImagesResult = {
  /** file:// URIs of the rendered pages, in page order. Delete them when done. */
  uris: string[];
  /** Pages in the document; more than `uris.length` when maxPages cut it short. */
  pageCount: number;
};

type NativePdfRenderer = {
  renderToImages(
    uri: string,
    options: { maxPages: number; width: number; quality: number },
  ): Promise<RenderToImagesResult>;
};

// null in a build made before this module was added (or on web), instead of crashing at import.
const native = requireOptionalNativeModule<NativePdfRenderer>('PdfRenderer');

export function isPdfRendererAvailable() {
  return native != null;
}

/** Renders a local PDF's pages to images. Throws if the module isn't in this build. */
export async function renderPdfToImages(
  uri: string,
  { maxPages = 10, width = 2000, quality = 0.9 }: RenderToImagesOptions = {},
): Promise<RenderToImagesResult> {
  if (!native) throw new Error('PDF rendering isn’t available in this build of the app.');
  return native.renderToImages(uri, {
    maxPages,
    width,
    // iOS takes 0–1, Android 0–100.
    quality: Platform.OS === 'android' ? Math.round(quality * 100) : quality,
  });
}
