using System.Text.Encodings.Web;
using System.Text.Json;

namespace MyManabi.OcrWorker;

public static class JsonConfig
{
    /// <summary>Write camelCase, indented, with raw (un-escaped) Japanese.</summary>
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static readonly JsonSerializerOptions ReadOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };
}
