using System.Globalization;

namespace MyManabi.OcrWorker;

public sealed class CliOptions
{
    public string? SourceDocumentId { get; private set; }
    public string? PdfPath { get; private set; }
    public string? DataDir { get; private set; }
    public string? Tessdata { get; private set; }
    public string Language { get; private set; } = "jpn+jpn_vert";
    public int Dpi { get; private set; } = 300;
    public string? Password { get; private set; }
    public bool NoCrops { get; private set; }
    public int MaxPages { get; private set; }

    /// <summary>Returns null when help was requested or parsing failed (usage already printed).</summary>
    public static CliOptions? Parse(string[] args)
    {
        var o = new CliOptions();

        for (int i = 0; i < args.Length; i++)
        {
            string arg = args[i];
            string Next(string name) => i + 1 < args.Length
                ? args[++i]
                : throw new ArgumentException($"missing value for {name}");

            try
            {
                switch (arg)
                {
                    case "-h" or "--help":
                        PrintUsage();
                        return null;
                    case "-s" or "--source-document":
                        o.SourceDocumentId = Next(arg);
                        break;
                    case "--pdf":
                        o.PdfPath = Next(arg);
                        break;
                    case "--data-dir":
                        o.DataDir = Next(arg);
                        break;
                    case "--tessdata":
                        o.Tessdata = Next(arg);
                        break;
                    case "--lang":
                        o.Language = Next(arg);
                        break;
                    case "--dpi":
                        o.Dpi = int.Parse(Next(arg), CultureInfo.InvariantCulture);
                        break;
                    case "--password":
                        o.Password = Next(arg);
                        break;
                    case "--no-crops":
                        o.NoCrops = true;
                        break;
                    case "--max-pages":
                        o.MaxPages = int.Parse(Next(arg), CultureInfo.InvariantCulture);
                        break;
                    default:
                        Console.Error.WriteLine($"unknown argument: {arg}");
                        PrintUsage();
                        return null;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"error: {ex.Message}");
                PrintUsage();
                return null;
            }
        }

        if (o.SourceDocumentId is null && o.PdfPath is null)
        {
            Console.Error.WriteLine("error: provide --source-document <id> or --pdf <path>");
            PrintUsage();
            return null;
        }
        if (o.Dpi <= 0)
        {
            Console.Error.WriteLine("error: --dpi must be positive");
            return null;
        }

        return o;
    }

    private static void PrintUsage()
    {
        Console.Error.WriteLine(
            """
            MyManabi OCR worker — rasterize a stored PDF and propose question candidates.

            Usage:
              MyManabi.OcrWorker --source-document <id> [options]
              MyManabi.OcrWorker --pdf <path> [options]

            Options:
              -s, --source-document <id>  SourceDocument id under
                                          <DATA_DIR>/content/source-documents/<id>.json
                  --pdf <path>            Process a PDF file directly (id from file name)
                  --data-dir <path>       Override DATA_DIR
                                          (default: %MYMANABI_DATA_DIR% or %APPDATA%/MyManabi)
                  --tessdata <path>       Override tessdata dir
                                          (default: %MYMANABI_TESSDATA% or <DATA_DIR>/tessdata)
                  --lang <langs>          Tesseract languages (default: jpn+jpn_vert;
                                          auto-falls back to what is installed)
                  --dpi <n>               Raster DPI (default: 300)
                  --password <pw>         PDF open password
                  --no-crops              Do not write per-candidate region crops
                  --max-pages <n>         Process at most n pages (0 = all)
              -h, --help                  Show this help

            Output (under DATA_DIR, never committed):
              content/extractions/<id>/extraction-result.json   (also printed to stdout)
              content/extractions/<id>/page-NNN.png             full page raster
              content/extractions/<id>/page-NNN-cNN.png         candidate region crop
            """);
    }
}
