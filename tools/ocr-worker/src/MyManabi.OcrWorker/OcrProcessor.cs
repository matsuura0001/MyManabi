using SkiaSharp;
using Tesseract;

namespace MyManabi.OcrWorker;

/// <summary>Tesseract wrapper: full-page text plus per-line text/confidence/bounds.</summary>
public sealed class OcrProcessor : IDisposable
{
    private readonly TesseractEngine _engine;

    public string Language { get; }
    public string Version { get; }

    public OcrProcessor(string tessdataPath, string language)
    {
        _engine = new TesseractEngine(tessdataPath, language, EngineMode.Default);
        Language = language;
        Version = typeof(TesseractEngine).Assembly.GetName().Version?.ToString() ?? "unknown";
    }

    public OcrPageOutput Recognize(SKBitmap bitmap)
    {
        using var pix = ToPix(bitmap);
        using var page = _engine.Process(pix, PageSegMode.Auto);

        string text = (page.GetText() ?? string.Empty).Trim();
        double meanConfidence = page.GetMeanConfidence();

        var lines = new List<OcrLine>();
        using (var iter = page.GetIterator())
        {
            iter.Begin();
            do
            {
                if (!iter.TryGetBoundingBox(PageIteratorLevel.TextLine, out Rect r))
                    continue;

                string lineText = (iter.GetText(PageIteratorLevel.TextLine) ?? string.Empty)
                    .Replace("\r", " ")
                    .Replace("\n", " ")
                    .Trim();
                if (lineText.Length == 0)
                    continue;

                float confidence = iter.GetConfidence(PageIteratorLevel.TextLine) / 100f;
                lines.Add(new OcrLine(lineText, confidence, new PixelRect(r.X1, r.Y1, r.Width, r.Height)));
            }
            while (iter.Next(PageIteratorLevel.TextLine));
        }

        return new OcrPageOutput(text, meanConfidence, lines);
    }

    private static Pix ToPix(SKBitmap bitmap)
    {
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return Pix.LoadFromMemory(data.ToArray());
    }

    public void Dispose() => _engine.Dispose();
}
