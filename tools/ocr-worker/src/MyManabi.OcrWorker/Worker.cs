using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MyManabi.OcrWorker;

/// <summary>
/// Orchestrates one import: resolve the source, rasterize PDF/image pages or read
/// UTF-8 text, split into candidates, and write an extraction-result.json under DATA_DIR.
/// </summary>
public static class Worker
{
    public static ExtractionResult Rasterize(CliOptions options)
    {
        var stopwatch = Stopwatch.StartNew();

        string dataDir = options.DataDir is null ? DataDir.Resolve() : Path.GetFullPath(options.DataDir);
        var (document, sourcePath) = ResolveSource(options, dataDir);
        if (document.Kind == "text")
            throw new InvalidOperationException("raster-only import is not supported for text sources");

        string relativeDir = $"content/extractions/{document.Id}";
        string outputDir = Path.Combine(dataDir, "content", "extractions", document.Id);
        Directory.CreateDirectory(outputDir);

        var pages = new List<PageResult>();
        foreach (var (index, bitmap) in RenderPages(document, sourcePath, options))
        {
            using (bitmap)
            {
                int pageNumber = index + 1;
                string pageFile = $"page-{pageNumber:D3}.png";
                ImageOps.SavePng(bitmap, Path.Combine(outputDir, pageFile));
                pages.Add(new PageResult
                {
                    Page = pageNumber,
                    Width = bitmap.Width,
                    Height = bitmap.Height,
                    ImagePath = $"{relativeDir}/{pageFile}",
                    OcrText = "",
                    MeanConfidence = 0,
                });
            }
        }

        var result = new ExtractionResult
        {
            SourceDocumentId = document.Id,
            Engine = "raster-only",
            EngineVersion = "",
            Language = "und",
            Dpi = options.Dpi,
            GeneratedAtEpochSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            PageCount = pages.Count,
            Pages = pages,
            Candidates = new List<CandidateResult>(),
            Metrics = new ImportMetrics
            {
                ExtractionRoute = "raster-only",
                LocalOcrEngine = "none",
                Pages = pages.Count,
                CandidateQuestions = 0,
                ElapsedMs = stopwatch.ElapsedMilliseconds,
            },
        };

        WriteResult(outputDir, relativeDir, result);
        return result;
    }

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

        var (questionCandidates, answerCandidates, answerLinks) = BuildAnswerPairs(document.Id, pages, candidates);

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
            Candidates = questionCandidates,
            AnswerCandidates = answerCandidates,
            AnswerLinks = answerLinks,
            Metrics = new ImportMetrics
            {
                Pages = pages.Count,
                CandidateQuestions = questionCandidates.Count,
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

    private static (List<CandidateResult> Questions, List<AnswerCandidateResult> Answers, List<AnswerLinkResult> Links)
        BuildAnswerPairs(string documentId, IReadOnlyList<PageResult> pages, IReadOnlyList<CandidateResult> candidates)
    {
        var answerPages = pages
            .Where(page => LooksLikeAnswerPage(page.OcrText))
            .Select(page => page.Page)
            .ToHashSet();

        if (answerPages.Count == 0)
            return (candidates.ToList(), new List<AnswerCandidateResult>(), new List<AnswerLinkResult>());

        var questions = candidates.Where(candidate => !answerPages.Contains(candidate.Page)).ToList();
        var answerSourceCandidates = candidates.Where(candidate => answerPages.Contains(candidate.Page)).ToList();
        var answers = answerSourceCandidates.Select((candidate, index) => new AnswerCandidateResult
        {
            AnswerCandidateId = $"{documentId}-p{candidate.Page:D3}-a{index + 1:D2}",
            Page = candidate.Page,
            ItemLabel = candidate.ItemLabel,
            Region = candidate.Region,
            RegionImagePath = candidate.RegionImagePath,
            OcrText = candidate.OcrText,
            Confidence = candidate.Confidence,
            SuggestedAnswer = SuggestAnswer(candidate.OcrText, candidate.Confidence),
        }).ToList();

        var links = new List<AnswerLinkResult>();
        var usedAnswerIds = new HashSet<string>();
        for (int index = 0; index < questions.Count; index++)
        {
            var question = questions[index];
            AnswerCandidateResult? answer = null;
            var matchReason = new List<string>();
            double confidence = 0.45;

            if (!string.IsNullOrWhiteSpace(question.ItemLabel))
            {
                answer = answers.FirstOrDefault(candidate =>
                    !usedAnswerIds.Contains(candidate.AnswerCandidateId) &&
                    candidate.ItemLabel == question.ItemLabel);
                if (answer is not null)
                {
                    matchReason.Add("item-label");
                    confidence = 0.78;
                }
            }

            if (answer is null && index < answers.Count)
            {
                answer = answers[index];
                matchReason.Add("sequence-order");
                confidence = 0.55;
            }

            if (answer is null)
                continue;

            usedAnswerIds.Add(answer.AnswerCandidateId);
            links.Add(new AnswerLinkResult
            {
                CandidateId = question.CandidateId,
                AnswerCandidateId = answer.AnswerCandidateId,
                MatchReason = matchReason,
                Confidence = confidence,
                ReviewStatus = "draft",
                SuggestedAnswer = answer.SuggestedAnswer,
            });
        }

        return (questions, answers, links);
    }

    private static bool LooksLikeAnswerPage(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return false;

        string head = text.Length <= 240 ? text : text[..240];
        return Regex.IsMatch(head, @"(解答|解[ 　]*説|答え|こたえ|答[ 　]*案)", RegexOptions.CultureInvariant);
    }

    private static SuggestedAnswer? SuggestAnswer(string text, double confidence)
    {
        var line = text
            .Split('\n', '\r')
            .Select(item => item.Trim())
            .FirstOrDefault(item => item.Length > 0);
        if (line is null)
            return null;

        string value = Regex.Replace(
            line,
            @"^[ 　]*(?:第[ 　]*[0-9０-９]+[ 　]*問|(?:大|設)?問[ 　]*[0-9０-９]+|[(（]?[0-9０-９]+[)）.．。、]?|[①-⑳])[ 　:：\-]*",
            "",
            RegexOptions.CultureInvariant).Trim();

        if (value.Length == 0)
            value = line;

        return new SuggestedAnswer
        {
            Value = value,
            Source = "answer-ocr",
            Confidence = Math.Round(confidence, 3),
        };
    }

    private static void WriteResult(string outputDir, string relativeDir, ExtractionResult result)
    {
        string json = JsonSerializer.Serialize(result, JsonConfig.Options);
        File.WriteAllText(Path.Combine(outputDir, "extraction-result.json"), json, new UTF8Encoding(false));
        Console.Error.WriteLine($"wrote {result.PageCount} page(s), {result.Candidates.Count} candidate(s) -> {relativeDir}/extraction-result.json");
    }

    /// <summary>
    /// Re-run OCR on a single user-specified region of an already-rasterized page.
    /// Outputs a single <see cref="CandidateResult"/> JSON to stdout so the Rust host
    /// can merge it into the existing extraction-result.json without overwriting other candidates.
    /// </summary>
    public static CandidateResult RunRegion(CliOptions options)
    {
        string dataDir = options.DataDir is null ? DataDir.Resolve() : Path.GetFullPath(options.DataDir);
        var (document, _) = ResolveSource(options, dataDir);

        int page = options.Page!.Value;
        var region = options.Region!;
        string candidateId = options.CandidateId!;

        if (!double.IsFinite(region.X) || !double.IsFinite(region.Y) ||
            !double.IsFinite(region.Width) || !double.IsFinite(region.Height) ||
            region.X < 0 || region.Y < 0 || region.Width <= 0 || region.Height <= 0 ||
            region.X + region.Width > 1 + 1e-9 || region.Y + region.Height > 1 + 1e-9)
            throw new ArgumentOutOfRangeException(nameof(region),
                "region fields must be finite ratios in 0..1 with width/height > 0 and x+w ≤ 1, y+h ≤ 1");

        string outputDir = Path.Combine(dataDir, "content", "extractions", document.Id);
        string pagePath = Path.Combine(outputDir, $"page-{page:D3}.png");

        if (!File.Exists(pagePath))
            throw new FileNotFoundException(
                $"page image not found: {pagePath}. Run full extraction first to generate page images.");

        using var pageBitmap = SkiaSharp.SKBitmap.Decode(pagePath)
            ?? throw new InvalidOperationException($"could not decode page image: {pagePath}");

        var pixelRect = new PixelRect(
            X: (int)(region.X * pageBitmap.Width),
            Y: (int)(region.Y * pageBitmap.Height),
            Width: (int)(region.Width * pageBitmap.Width),
            Height: (int)(region.Height * pageBitmap.Height)
        );

        string tessdata = TessdataResolver.Resolve(options.Tessdata, dataDir);
        string language = TessdataResolver.ResolveLanguage(tessdata, options.Language);
        Console.Error.WriteLine(
            $"re-extract {candidateId} page={page} " +
            $"region=({region.X:F3},{region.Y:F3},{region.Width:F3},{region.Height:F3})");
        Console.Error.WriteLine($"tessdata : {tessdata} (lang={language})");

        using var crop = ImageOps.Crop(pageBitmap, pixelRect, pad: 4)
            ?? throw new InvalidOperationException("specified region is empty or out of bounds");

        using var ocr = new OcrProcessor(tessdata, language);
        OcrPageOutput ocrOutput = ocr.Recognize(crop);

        string cropFile = CropFileName(candidateId, page);
        ImageOps.SavePng(crop, Path.Combine(outputDir, cropFile));

        string relativeDir = $"content/extractions/{document.Id}";
        var candidate = new CandidateResult
        {
            CandidateId = candidateId,
            Page = page,
            Region = ImageOps.ToRatio(pixelRect, pageBitmap.Width, pageBitmap.Height),
            RegionImagePath = $"{relativeDir}/{cropFile}",
            OcrText = ocrOutput.Text,
            Confidence = Math.Round(ocrOutput.MeanConfidence, 3),
            SuggestedQuestionType = QuestionTypeHeuristic.Suggest(ocrOutput.Text),
            ReviewStatus = "draft",
        };
        Console.Error.WriteLine($"re-extracted {candidateId}: {ocrOutput.Lines.Count} line(s), conf={candidate.Confidence:F3}");
        return candidate;
    }

    private static string CropFileName(string candidateId, int page)
    {
        // candidateId format: {docId}-p001-c02 — extract the trailing -cNN index
        int idx = candidateId.LastIndexOf("-c");
        if (idx >= 0 && int.TryParse(candidateId[(idx + 2)..], CultureInfo.InvariantCulture, out int index))
            return $"page-{page:D3}-c{index:D2}.png";
        return $"page-{page:D3}-region.png";
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
