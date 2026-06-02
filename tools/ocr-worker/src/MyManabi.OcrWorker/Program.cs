using System.Text;
using System.Text.Json;
using MyManabi.OcrWorker;

// Emit UTF-8 on stdout so Japanese OCR text is not mangled when the process is piped.
try { Console.OutputEncoding = new UTF8Encoding(false); } catch { /* stdout may not support it */ }

CliOptions? options = CliOptions.Parse(args);
if (options is null)
    return 2; // help shown or arguments invalid

try
{
    ExtractionResult result = Worker.Run(options);
    Console.Out.WriteLine(JsonSerializer.Serialize(result, JsonConfig.Options));
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"error: {ex.Message}");
    return 1;
}
