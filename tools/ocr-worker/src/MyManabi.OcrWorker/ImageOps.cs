using SkiaSharp;

namespace MyManabi.OcrWorker;

public static class ImageOps
{
    public static void SavePng(SKBitmap bitmap, string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 90);
        using var stream = File.Create(path);
        data.SaveTo(stream);
    }

    /// <summary>Crop a padded region; returns null if the rectangle is empty.</summary>
    public static SKBitmap? Crop(SKBitmap page, PixelRect rect, int pad)
    {
        int x = Math.Max(0, rect.X - pad);
        int y = Math.Max(0, rect.Y - pad);
        int right = Math.Min(page.Width, rect.Right + pad);
        int bottom = Math.Min(page.Height, rect.Bottom + pad);
        int width = right - x;
        int height = bottom - y;
        if (width <= 0 || height <= 0)
            return null;

        var dst = new SKBitmap(width, height);
        if (!page.ExtractSubset(dst, new SKRectI(x, y, right, bottom)))
        {
            dst.Dispose();
            return null;
        }
        return dst;
    }

    public static RegionRatio ToRatio(PixelRect rect, int pageWidth, int pageHeight)
    {
        static double Clamp(double v) => Math.Clamp(v, 0, 1);
        return new RegionRatio
        {
            X = Math.Round(Clamp((double)rect.X / pageWidth), 4),
            Y = Math.Round(Clamp((double)rect.Y / pageHeight), 4),
            Width = Math.Round(Clamp((double)rect.Width / pageWidth), 4),
            Height = Math.Round(Clamp((double)rect.Height / pageHeight), 4),
        };
    }
}
