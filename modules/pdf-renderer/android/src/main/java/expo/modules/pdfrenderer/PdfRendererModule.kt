package expo.modules.pdfrenderer

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Renders the pages of a local PDF to JPEG files in the cache directory, so on-device OCR
 * (expo-text-extractor) can read them. Uses the platform's android.graphics.pdf.PdfRenderer; nothing
 * leaves the phone.
 */
class PdfRendererModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PdfRenderer")

    // Runs off the JS thread. Resolves with { uris, pageCount }: file:// URIs of the rendered pages
    // in page order, and how many pages the document has (more than rendered past maxPages).
    AsyncFunction("renderToImages") { uri: String, options: RenderOptions ->
      render(uri, options)
    }
  }

  private fun render(uri: String, options: RenderOptions): Map<String, Any> {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    // The content resolver opens both file:// and content:// (document picker) URIs.
    val descriptor = try {
      context.contentResolver.openFileDescriptor(Uri.parse(uri), "r")
    } catch (e: Exception) {
      throw PdfOpenException(e)
    } ?: throw PdfOpenException(null)

    return descriptor.use { fd ->
      val renderer = openRenderer(fd)
      try {
        val pageCount = renderer.pageCount
        if (pageCount == 0) throw PdfEmptyException()

        val outputDirectory = makeOutputDirectory()
        val width = options.width.coerceIn(500, 4000)
        val quality = options.quality.coerceIn(30, 100)
        val count = minOf(pageCount, options.maxPages.coerceAtLeast(1))

        val uris = (0 until count).map { index ->
          val page = renderer.openPage(index)
          try {
            // Very tall pages (receipts, long scans) are capped so one page can't exhaust memory.
            val height = (width.toLong() * page.height / page.width).toInt().coerceIn(1, 8000)
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            try {
              // PDF pages can be transparent, which turns black in a JPEG and blinds the OCR.
              bitmap.eraseColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              val file = File(outputDirectory, "page-${index + 1}.jpg")
              FileOutputStream(file).use { out ->
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)) {
                  throw PdfRenderException(index + 1, null)
                }
              }
              Uri.fromFile(file).toString()
            } finally {
              bitmap.recycle()
            }
          } catch (e: CodedException) {
            throw e
          } catch (e: Exception) {
            throw PdfRenderException(index + 1, e)
          } finally {
            page.close()
          }
        }
        mapOf("uris" to uris, "pageCount" to pageCount)
      } finally {
        renderer.close()
      }
    }
  }

  private fun openRenderer(fd: ParcelFileDescriptor): PdfRenderer {
    return try {
      PdfRenderer(fd)
    } catch (e: SecurityException) {
      // Thrown for password-protected documents.
      throw PdfPasswordException(e)
    } catch (e: Exception) {
      throw PdfOpenException(e)
    }
  }

  /**
   * A fresh folder under cache/pdf-pages. Folders left by earlier renders more than an hour old are
   * removed first (JS deletes its pages after OCR; this catches anything it missed).
   */
  private fun makeOutputDirectory(): File {
    val root = File(appContext.cacheDirectory, "pdf-pages")
    val cutoff = System.currentTimeMillis() - 60 * 60 * 1000
    root.listFiles()?.forEach { folder ->
      if (folder.lastModified() < cutoff) folder.deleteRecursively()
    }
    return File(root, UUID.randomUUID().toString()).apply { mkdirs() }
  }
}

class RenderOptions : Record {
  /** Pages after this are skipped (lab reports are short; this bounds time and memory). */
  @Field
  val maxPages: Int = 10

  /** Output width in pixels. ~2000 px keeps small print legible for OCR. */
  @Field
  val width: Int = 2000

  /** JPEG quality, 0..100. */
  @Field
  val quality: Int = 90
}

internal class PdfOpenException(cause: Throwable?) :
  CodedException("ERR_PDF_OPEN", "Could not open this PDF. It may be damaged or not a PDF.", cause)

internal class PdfPasswordException(cause: Throwable?) :
  CodedException("ERR_PDF_PASSWORD", "This PDF is password-protected.", cause)

internal class PdfEmptyException :
  CodedException("ERR_PDF_EMPTY", "This PDF has no pages.", null)

internal class PdfRenderException(page: Int, cause: Throwable?) :
  CodedException("ERR_PDF_RENDER", "Could not render page $page of this PDF.", cause)
