#:package SkiaSharp@2.88.8
// Dev helper: generate a small synthetic Japanese worksheet PDF for smoke-testing the
// OCR worker. Run with .NET 10 file-based apps:  dotnet run make-sample-pdf.cs -- <out.pdf>
// The generated PDF is synthetic (no copyrighted material) but is still .pdf-ignored.
using SkiaSharp;

string path = args.Length > 0 ? args[0] : "sample.pdf";

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

canvas.DrawText("さんすう プリント", 60, 70, paint);
canvas.DrawText("問1 つぎのけいさんをしましょう", 60, 140, paint);
canvas.DrawText("1 + 2 =", 90, 195, paint);
canvas.DrawText("(2) 3 + 5 =", 90, 245, paint);
canvas.DrawText("問2 かんじをかきましょう", 60, 340, paint);
canvas.DrawText("「やま」をかく", 90, 395, paint);

document.EndPage();
document.Close();

Console.WriteLine($"wrote {path}");
