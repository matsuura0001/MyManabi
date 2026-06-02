using PDFtoImage;
using SkiaSharp;

namespace MyManabi.OcrWorker;

/// <summary>
/// Rasterize PDF pages with PDFium. PDFium opens AES-encrypted PDFs that have an empty
/// user password (a common case for protected worksheets, spec §10), so the
/// rasterize-then-OCR route works where plain text extraction fails.
/// </summary>
public static class PdfRasterizer
{
    /// <summary>Render pages lazily as <see cref="SKBitmap"/>; the caller disposes each bitmap.</summary>
    public static IEnumerable<(int Index, SKBitmap Bitmap)> RenderPages(
        string pdfPath, int dpi, string? password, int maxPages)
    {
        var bytes = File.ReadAllBytes(pdfPath);
        using var ms = new MemoryStream(bytes, writable: false);

        int i = 0;
        foreach (var bitmap in Conversion.ToImages(
                     ms, leaveOpen: true, password: password, options: new RenderOptions(Dpi: dpi)))
        {
            if (maxPages > 0 && i >= maxPages)
            {
                bitmap.Dispose();
                yield break;
            }

            yield return (i, bitmap);
            i++;
        }
    }
}
