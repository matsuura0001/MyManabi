using MyManabi.OcrWorker;
using Xunit;

namespace MyManabi.OcrWorker.Tests;

public class CandidateSplitterTests
{
    private static OcrLine Line(string text, int y = 0, double confidence = 0.9)
        => new(text, confidence, new PixelRect(10, y, 200, 20));

    [Theory]
    [InlineData("問1 つぎの計算をしなさい", "1")]
    [InlineData("大問2", "2")]
    [InlineData("第3問", "3")]
    [InlineData("(4) こたえを書く", "4")]
    [InlineData("（５）", "5")]
    [InlineData("6. 漢字を書く", "6")]
    [InlineData("７．かく", "7")]
    [InlineData("①えらぶ", "1")]
    [InlineData("⑫", "12")]
    public void MatchesMarkersAndNormalizesLabel(string line, string expected)
    {
        Assert.True(CandidateSplitter.TryMatchMarker(line, out var label));
        Assert.Equal(expected, label);
    }

    [Theory]
    [InlineData("問題文をよく読みましょう")]   // 問題 must not trigger the 問N marker
    [InlineData("これは説明です")]
    [InlineData("2020年のできごと")]
    public void DoesNotMatchNonMarkers(string line)
    {
        Assert.False(CandidateSplitter.TryMatchMarker(line, out _));
    }

    [Fact]
    public void SplitsAtEachMarker()
    {
        var lines = new[]
        {
            Line("問1 けいさん", 0),
            Line("1 + 2 =", 30),
            Line("問2 かんじ", 60),
            Line("「やま」を書く", 90),
        };

        var candidates = CandidateSplitter.Split(lines);

        Assert.Equal(2, candidates.Count);
        Assert.Equal("1", candidates[0].ItemLabel);
        Assert.Equal("2", candidates[1].ItemLabel);
        Assert.Contains("1 + 2", candidates[0].Text);
        Assert.Contains("やま", candidates[1].Text);
    }

    [Fact]
    public void KeepsPreambleBeforeFirstMarkerAsUnlabeledCandidate()
    {
        var lines = new[]
        {
            Line("さんすう プリント", 0),
            Line("問1 けいさん", 30),
        };

        var candidates = CandidateSplitter.Split(lines);

        Assert.Equal(2, candidates.Count);
        Assert.Null(candidates[0].ItemLabel);
        Assert.Equal("1", candidates[1].ItemLabel);
    }

    [Fact]
    public void WithoutMarkersReturnsSingleWholePageCandidate()
    {
        var lines = new[]
        {
            Line("ここに問題があります", 0),
            Line("こたえを書きましょう", 30),
        };

        var candidates = CandidateSplitter.Split(lines);

        Assert.Single(candidates);
        Assert.Null(candidates[0].ItemLabel);
    }

    [Fact]
    public void BoundsUnionCoversAllLines()
    {
        var lines = new[]
        {
            new OcrLine("問1", 0.9, new PixelRect(10, 10, 100, 20)),
            new OcrLine("つづき", 0.9, new PixelRect(40, 50, 200, 30)),
        };

        var candidate = CandidateSplitter.Split(lines).Single();
        var bounds = candidate.Bounds;

        Assert.Equal(10, bounds.X);
        Assert.Equal(10, bounds.Y);
        Assert.Equal(230, bounds.Width);  // 40 + 200 - 10
        Assert.Equal(70, bounds.Height);  // 50 + 30 - 10
    }

    [Fact]
    public void EmptyInputReturnsNoCandidates()
    {
        Assert.Empty(CandidateSplitter.Split(Array.Empty<OcrLine>()));
    }
}
