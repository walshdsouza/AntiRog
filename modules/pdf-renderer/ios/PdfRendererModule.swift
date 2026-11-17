import ExpoModulesCore
import PDFKit
import UIKit

/// Renders the pages of a local PDF to JPEG files in the cache directory, so on-device OCR
/// (expo-text-extractor) can read them. Nothing leaves the phone.
public class PdfRendererModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfRenderer")

    // Runs on a background queue. Resolves with { uris, pageCount }: file:// URIs of the rendered
    // pages in page order, and how many pages the document has (more than rendered past maxPages).
    AsyncFunction("renderToImages") { (uri: URL, options: RenderOptions) throws -> [String: Any] in
      try render(uri: uri, options: options)
    }
  }

  private func render(uri: URL, options: RenderOptions) throws -> [String: Any] {
    guard uri.isFileURL else {
      throw PdfOpenException()
    }
    // Files handed over by the document picker may be security-scoped.
    let scoped = uri.startAccessingSecurityScopedResource()
    defer {
      if scoped { uri.stopAccessingSecurityScopedResource() }
    }

    guard let document = PDFDocument(url: uri) else {
      throw PdfOpenException()
    }
    if document.isLocked && !document.unlock(withPassword: "") {
      throw PdfPasswordException()
    }
    let pageCount = document.pageCount
    if pageCount == 0 {
      throw PdfEmptyException()
    }

    let outputDirectory = try makeOutputDirectory()
    let width = CGFloat(max(500, min(options.width, 4000)))
    let quality = CGFloat(max(0.3, min(options.quality, 1.0)))
    let count = min(pageCount, max(1, options.maxPages))

    // Exactly `width` pixels wide: scale 1, so the screen's 2x/3x doesn't multiply the image size.
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true

    var uris: [String] = []
    for index in 0..<count {
      guard let page = document.page(at: index) else { continue }
      let bounds = page.bounds(for: .cropBox)
      // Rotated pages are displayed with width and height swapped.
      let rotated = page.rotation % 180 != 0
      let pageWidth = rotated ? bounds.height : bounds.width
      let pageHeight = rotated ? bounds.width : bounds.height
      guard pageWidth > 0, pageHeight > 0 else { continue }
      // Very tall pages (receipts, long scans) are capped so one page can't exhaust memory.
      let height = min(width * pageHeight / pageWidth, 8000)
      let size = CGSize(width: width, height: height)

      let image = autoreleasepool { () -> UIImage in
        // The thumbnail applies the page's rotation; draw it on white, because transparent page
        // backgrounds would turn black in a JPEG and blind the OCR.
        let rendered = page.thumbnail(of: size, for: .cropBox)
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
          UIColor.white.setFill()
          context.fill(CGRect(origin: .zero, size: size))
          rendered.draw(in: CGRect(origin: .zero, size: size))
        }
      }
      guard let data = image.jpegData(compressionQuality: quality) else {
        throw PdfRenderException(index + 1)
      }
      let file = outputDirectory.appendingPathComponent("page-\(index + 1).jpg")
      do {
        try data.write(to: file, options: .atomic)
      } catch {
        throw PdfRenderException(index + 1)
      }
      uris.append(file.absoluteString)
    }

    if uris.isEmpty {
      throw PdfEmptyException()
    }
    return ["uris": uris, "pageCount": pageCount]
  }

  /// A fresh folder under Caches/pdf-pages. Folders left by earlier renders more than an hour old
  /// are removed first (JS deletes its pages after OCR; this catches anything it missed).
  private func makeOutputDirectory() throws -> URL {
    let fileManager = FileManager.default
    guard let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      throw PdfOpenException()
    }
    let root = caches.appendingPathComponent("pdf-pages", isDirectory: true)
    if let old = try? fileManager.contentsOfDirectory(
      at: root, includingPropertiesForKeys: [.contentModificationDateKey]
    ) {
      let cutoff = Date().addingTimeInterval(-3600)
      for folder in old {
        let modified = (try? folder.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
        if let modified, modified < cutoff {
          try? fileManager.removeItem(at: folder)
        }
      }
    }
    let directory = root.appendingPathComponent(UUID().uuidString, isDirectory: true)
    try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }
}

struct RenderOptions: Record {
  /// Pages after this are skipped (lab reports are short; this bounds time and memory).
  @Field var maxPages: Int = 10
  /// Output width in pixels. ~2000 px keeps small print legible for OCR.
  @Field var width: Double = 2000
  /// JPEG quality, 0...1.
  @Field var quality: Double = 0.9
}

internal final class PdfOpenException: Exception {
  override var code: String { "ERR_PDF_OPEN" }
  override var reason: String { "Could not open this PDF. It may be damaged or not a PDF." }
}

internal final class PdfPasswordException: Exception {
  override var code: String { "ERR_PDF_PASSWORD" }
  override var reason: String { "This PDF is password-protected." }
}

internal final class PdfEmptyException: Exception {
  override var code: String { "ERR_PDF_EMPTY" }
  override var reason: String { "This PDF has no pages." }
}

internal final class PdfRenderException: GenericException<Int> {
  override var code: String { "ERR_PDF_RENDER" }
  override var reason: String { "Could not render page \(param) of this PDF." }
}
