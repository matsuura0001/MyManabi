namespace MyManabi.OcrWorker;

/// <summary>Axis-aligned rectangle in page pixels.</summary>
public readonly record struct PixelRect(int X, int Y, int Width, int Height)
{
    public int Right => X + Width;
    public int Bottom => Y + Height;

    public static PixelRect Union(PixelRect a, PixelRect b)
    {
        int x = Math.Min(a.X, b.X);
        int y = Math.Min(a.Y, b.Y);
        int right = Math.Max(a.Right, b.Right);
        int bottom = Math.Max(a.Bottom, b.Bottom);
        return new PixelRect(x, y, right - x, bottom - y);
    }
}

/// <summary>One OCR text line with its confidence (0..1) and pixel bounds.</summary>
public sealed record OcrLine(string Text, double Confidence, PixelRect Bounds);

/// <summary>Full OCR output for one rasterized page.</summary>
public sealed record OcrPageOutput(string Text, double MeanConfidence, IReadOnlyList<OcrLine> Lines);
