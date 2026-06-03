using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace MyManabi.OcrWorker;

/// <summary>
/// Orchestrates one import: resolve the source, rasterize PDF/image pages or read
/// UTF-8 text, split into candidates, and write an extraction-result.json under DATA_DIR.
/// </summary>
public static class Worker
{
    public static ExtractionResult Run(CliOptions options)
    {
        var stopwatch = Stopwatch.StartNew();

        string dataDir = options.DataDir is null ? DataDir.Resolve() : Path.GetFullPath(options.DataDir);
        var (document, sourcePath) = ResolveSource(options, dataDir);

        if (document.Kind == "text")
            return RunText(document, sourcePath, dataDir, stopwatch);

        string tessdata = TessdataResolver.Resolve(options.Tessdata, dataDir);
        string language = TessdataResolver.ResolveLanguage(tessdata, options.Language);

        Console.Error.WriteLine($"data-dir : {dataDir}");
        Console.Error.WriteLine($"source   : {sourcePath}");
        Console.Error.WriteLine($"tessdata : {tessdata} (lang={language})");

        string relativeDir = $"content/extractions/{document.Id}";
        string outputDir = Path.Combine(dataDir, "content", "extractions", document.Id);
        Directory.CreateDirectory(outputDir);

        using var ocr = new OcrProcessor(tessdata, language);
        var pages = new List<PageResult>();
        var candidates = new List<CandidateResult>();

        foreach (var (index, bitmap) in RenderPages(document, sourcePath, options))
        {
            using (bitmap)
            {
                int pageNumber = index + 1;
                string pageFile = $"page-{pageNumber:D3}.png";
                ImageOps.SavePng(bitmap, Path.Combine(outputDir, pageFile));

                OcrPageOutput ocrOutput = ocr.Recognize(bitmap);
                pages.Add(new PageResult
                {
                    Page = pageNumber,
                    Width = bitmap.Width,
                    Height = bitmap.Height,
                    ImagePath = $"{relativeDir}/{pageFile}",
                    OcrText = ocrOutput.Text,
                    MeanConfidence = Math.Round(ocrOutput.MeanConfidence, 3),
                });

                int candidateIndex = 0;
                foreach (var candidate in CandidateSplitter.Split(ocrOutput.Lines))
                {
                    candidateIndex++;
                    PixelRect bounds = candidate.Bounds;
                    string candidateId = $"{document.Id}-p{pageNumber:D3}-c{candidateIndex:D2}";

                    string? regionImagePath = null;
                    if (!options.NoCrops)
                    {
                        using SkiaSharp.SKBitmap? crop = ImageOps.Crop(bitmap, bounds, pad: Math.Max(4, options.Dpi / 24));
                        if (crop is not null)
                        {
                            string cropFile = $"page-{pageNumber:D3}-c{candidateIndex:D2}.png";
                            ImageOps.SavePng(crop, Path.Combine(outputDir, cropFile));
                            regionImagePath = $"{relativeDir}/{cropFile}";
                        }
                    }

                    candidates.Add(new CandidateResult
                    {
                        CandidateId = candidateId,
                        Page = pageNumber,
                        ItemLabel = candidate.ItemLabel,
                        Region = ImageOps.ToRatio(bounds, bitmap.Width, bitmap.Height),
                        RegionImagePath = regionImagePath,
                        OcrText = candidate.Text,
                        Confidence = Math.Round(candidate.Confidence, 3),
                        SuggestedQuestionType = QuestionTypeHeuristic.Suggest(candidate.Text),
                        ReviewStatus = "draft",
                    });
                }

                Console.Error.WriteLine($"page {pageNumber}: {ocrOutput.Lines.Count} line(s), {candidateIndex} candidate(s)");
            }
        }

        var result = new ExtractionResult
        {
            SourceDocumentId = document.Id,
            Engine = "tesseract",
            EngineVersion = ocr.Version,
            Language = language,
            Dpi = options.Dpi,
            GeneratedAtEpochSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            PageCount = pages.Count,
            Pages = pages,
            Candidates = candidates,
            Metrics = new ImportMetrics
            {
                Pages = pages.Count,
                CandidateQuestions = candidates.Count,
                ElapsedMs = stopwatch.ElapsedMilliseconds,
            },
        };

        WriteResult(outputDir, relativeDir, result);
        return result;
    }

    private static ExtractionResult RunText(
        SourceDocument document, string sourcePath, string dataDir, Stopwatch stopwatch)
    {
        Console.Error.WriteLine($"data-dir : {dataDir}");
        Console.Error.WriteLine($"source   : {sourcePath}");
        string text = File.ReadAllText(sourcePath, Encoding.UTF8);
        string relativeDir = $"content/extractions/{document.Id}";
        string outputDir = Path.Combine(dataDir, "content", "extractions", document.Id);
        Directory.CreateDirectory(outputDir);

        var candidates = new List<CandidateResult>();
        if (!string.IsNullOrWhiteSpace(text))
        {
            candidates.Add(new CandidateResult
            {
                CandidateId = $"{document.Id}-text-c01",
                Page = 1,
                Region = new RegionRatio { X = 0, Y = 0, Width = 1, Height = 1 },
                OcrText = text,
                Confidence = 1,
                SuggestedQuestionType = QuestionTypeHeuristic.Suggest(text),
                ReviewStatus = "draft",
            });
        }

        var result = new ExtractionResult
        {
            SourceDocumentId = document.Id,
            Engine = "plain-text",
            EngineVersion = "",
            Language = "und",
            Dpi = 1,
            GeneratedAtEpochSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            PageCount = 0,
            Candidates = candidates,
            Metrics = new ImportMetrics
            {
                ExtractionRoute = "plain-text",
                LocalOcrEngine = "none",
                CandidateQuestions = candidates.Count,
                ElapsedMs = stopwatch.ElapsedMilliseconds,
            },
        };
        WriteResult(outputDir, relativeDir, result);
        return result;
    }

    private static IEnumerable<(int Index, SkiaSharp.SKBitmap Bitmap)> RenderPages(
        SourceDocument document, string sourcePath, CliOptions options)
    {
        if (document.Kind == "pdf")
            return PdfRasterizer.RenderPages(sourcePath, options.Dpi, options.Password, options.MaxPages);

        if (document.Kind == "image")
            return RenderImage(sourcePath);

        throw new InvalidOperationException($"OCR is not supported for source kind: {document.Kind}");
    }

    private static IEnumerable<(int Index, SkiaSharp.SKBitmap Bitmap)> RenderImage(string sourcePath)
    {
        SkiaSharp.SKBitmap bitmap = SkiaSharp.SKBitmap.Decode(sourcePath)
            ?? throw new InvalidOperationException($"could not decode image: {sourcePath}");
        yield return (0, bitmap);
    }

    private static void WriteResult(string outputDir, string relativeDir, ExtractionResult result)
    {
        string json = JsonSerializer.Serialize(result, JsonConfig.Options);
        File.WriteAllText(Path.Combine(outputDir, "extraction-result.json"), json, new UTF8Encoding(false));
        Console.Error.WriteLine($"wrote {result.PageCount} page(s), {result.Candidates.Count} candidate(s) -> {relativeDir}/extraction-result.json");
    }

    private static (SourceDocument Document, string SourcePath) ResolveSource(CliOptions options, string dataDir)
    {
        if (options.SourceDocumentId is not null)
        {
            string metaPath = Path.Combine(dataDir, "content", "source-documents", options.SourceDocumentId + ".json");
            if (!File.Exists(metaPath))
                throw new FileNotFoundException($"SourceDocument metadata not found: {metaPath}");

            var document = JsonSerializer.Deserialize<SourceDocument>(File.ReadAllText(metaPath), JsonConfig.ReadOptions)
                ?? throw new InvalidOperationException($"could not parse {metaPath}");

            string sourcePath = Path.Combine(dataDir, document.StoredPath.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(sourcePath))
                throw new FileNotFoundException($"stored source file not found: {sourcePath}");

            return (document, sourcePath);
        }

        string path = Path.GetFullPath(options.PdfPath!);
        if (!File.Exists(path))
            throw new FileNotFoundException($"PDF not found: {path}");

        string id = Sanitize(Path.GetFileNameWithoutExtension(path));
        var synthesized = new SourceDocument
        {
            Id = id,
            Kind = "pdf",
            OriginalFileName = Path.GetFileName(path),
            StoredPath = $"sources/{id}.pdf",
            ByteSize = new FileInfo(path).Length,
            Status = "stored",
            ExtractionStatus = "pending-review",
        };
        return (synthesized, path);
    }

    private static string Sanitize(string stem)
    {
        var sb = new StringBuilder(stem.Length);
        foreach (char c in stem)
            sb.Append(char.IsAsciiLetterOrDigit(c) || c is '-' or '_' ? c : '-');
        string sanitized = sb.ToString().Trim('-');
        return sanitized.Length == 0 ? "imported-pdf" : sanitized;
    }
}
