using System.Text.Json.Serialization;

namespace MyManabi.OcrWorker;

/// <summary>
/// Mirror of <c>schemas/source-document.schema.json</c> as written by the Rust
/// importer (<c>app/src-tauri/src/source_document.rs</c>). Input to this worker.
/// </summary>
public sealed class SourceDocument
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "pdf";
    public string OriginalFileName { get; set; } = "";
    public string StoredPath { get; set; } = "";
    public string? SourceUrl { get; set; }
    public long ImportedAtEpochSeconds { get; set; }
    public long ByteSize { get; set; }
    public string Status { get; set; } = "stored";
    public string ExtractionStatus { get; set; } = "pending-review";
}

/// <summary>Region as ratios of the page (0..1), resolution-independent (spec §12.3).</summary>
public sealed class RegionRatio
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}

public sealed class PageResult
{
    public int Page { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string ImagePath { get; set; } = "";
    public string OcrText { get; set; } = "";
    public double MeanConfidence { get; set; }
}

/// <summary>A proposed question region. Always a suggestion — never auto-approved.</summary>
public sealed class CandidateResult
{
    public string CandidateId { get; set; } = "";
    public int Page { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ItemLabel { get; set; }

    public RegionRatio Region { get; set; } = new();

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? RegionImagePath { get; set; }

    public string OcrText { get; set; } = "";
    public double Confidence { get; set; }
    public string SuggestedQuestionType { get; set; } = "unknown";
    public string ReviewStatus { get; set; } = "draft";
}

/// <summary>Comparable import metrics (spec §11.5).</summary>
public sealed class ImportMetrics
{
    public string ExtractionRoute { get; set; } = "local-ocr";
    public string LocalOcrEngine { get; set; } = "tesseract";
    public int Pages { get; set; }
    public int CandidateQuestions { get; set; }
    public int AiAssistedRegions { get; set; }
    public int AdultCorrections { get; set; }
    public long ElapsedMs { get; set; }
    public double EstimatedApiCostUsd { get; set; }
}

/// <summary>Worker output. Intermediate review artifact, not final Question JSON.</summary>
public sealed class ExtractionResult
{
    public string SourceDocumentId { get; set; } = "";
    public string Engine { get; set; } = "tesseract";
    public string EngineVersion { get; set; } = "";
    public string Language { get; set; } = "";
    public int Dpi { get; set; }
    public long GeneratedAtEpochSeconds { get; set; }
    public int PageCount { get; set; }
    public List<PageResult> Pages { get; set; } = new();
    public List<CandidateResult> Candidates { get; set; } = new();
    public ImportMetrics Metrics { get; set; } = new();
}
