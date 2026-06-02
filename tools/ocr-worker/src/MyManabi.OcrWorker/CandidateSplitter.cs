using System.Text;
using System.Text.RegularExpressions;

namespace MyManabi.OcrWorker;

/// <summary>A run of OCR lines proposed as one question, with an optional item label.</summary>
public sealed record SplitCandidate(string? ItemLabel, IReadOnlyList<OcrLine> Lines)
{
    public string Text => string.Join("\n", Lines.Select(l => l.Text)).Trim();

    public double Confidence => Lines.Count == 0 ? 0 : Lines.Average(l => l.Confidence);

    public PixelRect Bounds
    {
        get
        {
            var r = Lines[0].Bounds;
            for (int i = 1; i < Lines.Count; i++)
                r = PixelRect.Union(r, Lines[i].Bounds);
            return r;
        }
    }
}

/// <summary>
/// Splits OCR lines into question candidates by detecting item-number markers at the
/// start of a line (問1 / 大問1 / 第1問 / (1) / １． / ① …). This only *proposes*
/// boundaries; nothing here is treated as confirmed (spec §11.3, §12.7).
/// </summary>
public static class CandidateSplitter
{
    // Ordered: first match wins. Group 1 captures the item number (half/full width or circled).
    private static readonly Regex[] Markers =
    {
        new(@"^[ \t　]*第[ \t　]*([0-9０-９]+)[ \t　]*問", RegexOptions.Compiled),
        new(@"^[ \t　]*(?:大|設)?問[ \t　]*([0-9０-９]+)", RegexOptions.Compiled),
        new(@"^[ \t　]*[(（][ \t　]*([0-9０-９]+)[ \t　]*[)）]", RegexOptions.Compiled),
        new(@"^[ \t　]*([0-9０-９]+)[ \t　]*[.．。、)）]", RegexOptions.Compiled),
        new(@"^[ \t　]*([①-⑳])", RegexOptions.Compiled),
    };

    public static bool TryMatchMarker(string line, out string label)
    {
        foreach (var rx in Markers)
        {
            var m = rx.Match(line);
            if (m.Success)
            {
                label = NormalizeLabel(m.Groups[1].Value);
                return true;
            }
        }
        label = "";
        return false;
    }

    public static List<SplitCandidate> Split(IReadOnlyList<OcrLine> lines)
    {
        var result = new List<SplitCandidate>();
        string? currentLabel = null;
        var current = new List<OcrLine>();

        void Flush()
        {
            if (current.Count > 0)
                result.Add(new SplitCandidate(currentLabel, current.ToList()));
            current.Clear();
        }

        foreach (var line in lines)
        {
            if (TryMatchMarker(line.Text, out var label))
            {
                Flush();
                currentLabel = label;
            }
            current.Add(line);
        }
        Flush();

        return result;
    }

    private static string NormalizeLabel(string raw)
    {
        // Circled digits ①..⑳ (U+2460..U+2473) -> 1..20
        if (raw.Length == 1 && raw[0] >= '①' && raw[0] <= '⑳')
            return (raw[0] - '①' + 1).ToString();

        // Full-width digits -> half width
        var sb = new StringBuilder(raw.Length);
        foreach (var c in raw)
            sb.Append(c >= '０' && c <= '９' ? (char)(c - '０' + '0') : c);
        return sb.ToString();
    }
}
