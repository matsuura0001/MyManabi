using MyManabi.OcrWorker;
using Xunit;

namespace MyManabi.OcrWorker.Tests;

public class QuestionTypeHeuristicTests
{
    [Theory]
    [InlineData("1 + 2 =")]
    [InlineData("３＋４＝")]
    [InlineData("12 × 3 = ")]
    [InlineData("8 ÷ 2")]
    public void DetectsNumeric(string text)
    {
        Assert.Equal("numeric", QuestionTypeHeuristic.Suggest(text));
    }

    [Theory]
    [InlineData("次のア〜エから正しいものを選びなさい")]
    [InlineData("ア. りんご イ. みかん ウ. ぶどう")]
    [InlineData("①はる ②なつ ③あき")]
    public void DetectsMultipleChoice(string text)
    {
        Assert.Equal("multiple-choice", QuestionTypeHeuristic.Suggest(text));
    }

    [Theory]
    [InlineData("公園")]
    [InlineData("「やま」を書きましょう")]
    [InlineData("車")]
    public void DetectsKanji(string text)
    {
        Assert.Equal("kanji", QuestionTypeHeuristic.Suggest(text));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("This is a long english sentence without japanese content at all.")]
    public void FallsBackToUnknown(string text)
    {
        Assert.Equal("unknown", QuestionTypeHeuristic.Suggest(text));
    }
}
