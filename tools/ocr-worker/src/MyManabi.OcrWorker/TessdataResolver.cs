namespace MyManabi.OcrWorker;

/// <summary>
/// Locate the tessdata folder and reduce the requested language list to what is
/// actually installed, so a missing <c>jpn_vert</c> degrades to <c>jpn</c> instead
/// of crashing.
/// </summary>
public static class TessdataResolver
{
    public static string Resolve(string? overridePath, string dataDir)
    {
        var env = Environment.GetEnvironmentVariable("MYMANABI_TESSDATA");
        var path = overridePath
            ?? (string.IsNullOrWhiteSpace(env) ? Path.Combine(dataDir, "tessdata") : env);
        return Path.GetFullPath(path);
    }

    public static string ResolveLanguage(string tessdataPath, string requested)
    {
        bool Installed(string lang) => File.Exists(Path.Combine(tessdataPath, lang + ".traineddata"));

        var available = requested
            .Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(Installed)
            .ToList();

        if (available.Count > 0)
            return string.Join("+", available);

        if (Installed("jpn"))
            return "jpn";

        throw new FileNotFoundException(
            $"No traineddata for '{requested}' under {tessdataPath}. " +
            "Run tools/ocr-worker/scripts/get-tessdata.ps1 to download jpn / jpn_vert.");
    }
}
