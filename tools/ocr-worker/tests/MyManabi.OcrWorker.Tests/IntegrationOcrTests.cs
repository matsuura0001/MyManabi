using System.Text.Json;
using MyManabi.OcrWorker;
using SkiaSharp;
using Xunit;

namespace MyManabi.OcrWorker.Tests;

/// <summary>
/// Exercises the native path (PDFium raster -> Tesseract OCR -> candidate split) end to
/// end on a synthetic Japanese PDF. Opt-in: it is a no-op unless
/// MYMANABI_OCR_INTEGRATION=1, because it needs downloaded tessdata and is slower /
/// less deterministic than the unit tests.
/// </summary>
public class IntegrationOcrTests
{
    private static bool Enabled =>
        Environment.GetEnvironmentVariable("MYMANABI_OCR_INTEGRATION") == "1";

    [Fact]
    public void EndToEnd_RasterizeOcrSplit()
    {
        if (!Enabled)
            return; // skipped unless explicitly enabled

        string root = Path.Combine(Path.GetTempPath(), "mymanabi-ocr-it-" + Guid.NewGuid().ToString("N"));
        string sources = Path.Combine(root, "sources");
        string metaDir = Path.Combine(root, "content", "source-documents");
        Directory.CreateDirectory(sources);
        Directory.CreateDirectory(metaDir);

        const string id = "it-sample";
        string pdfPath = Path.Combine(sources, id + ".pdf");
        WriteSamplePdf(pdfPath);

        var document = new SourceDocument
        {
            Id = id,
            Kind = "pdf",
            OriginalFileName = "sample.pdf",
            StoredPath = "sources/" + id + ".pdf",
            ByteSize = new FileInfo(pdfPath).Length,
            Status = "stored",
            ExtractionStatus = "pending-review",
        };
        File.WriteAllText(Path.Combine(metaDir, id + ".json"),
            JsonSerializer.Serialize(document, JsonConfig.Options));

        var options = CliOptions.Parse(new[] { "--source-document", id, "--data-dir", root, "--dpi", "200" })!;
        ExtractionResult result = Worker.Run(options);

        Assert.Equal(1, result.PageCount);
        Assert.NotEmpty(result.Candidates);
        Assert.True(File.Exists(Path.Combine(root, "content", "extractions", id, "extraction-result.json")));
        Assert.True(File.Exists(Path.Combine(root, "content", "extractions", id, "page-001.png")));

        try { Directory.Delete(root, recursive: true); } catch { /* best effort cleanup */ }
    }

    private static void WriteSamplePdf(string path)
    {
        using var stream = File.Create(path);
        using var document = SKDocument.CreatePdf(stream);
        var canvas = document.BeginPage(595, 842); // A4 in points
        canvas.Clear(SKColors.White);

        SKTypeface typeface = SKFontManager.Default.MatchCharacter('あ') ?? SKTypeface.Default;
        using var paint = new SKPaint
        {
            Color = SKColors.Black,
            IsAntialias = true,
            TextSize = 30,
            Typeface = typeface,
        };

        canvas.DrawText("問1 つぎのけいさんをしましょう", 60, 120, paint);
        canvas.DrawText("1 + 2 =", 80, 175, paint);
        canvas.DrawText("問2 かんじをかきましょう", 60, 280, paint);
        canvas.DrawText("「やま」をかく", 80, 335, paint);

        document.EndPage();
        document.Close();
    }
}
