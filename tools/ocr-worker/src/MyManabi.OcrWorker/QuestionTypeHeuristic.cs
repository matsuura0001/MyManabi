using System.Text.RegularExpressions;

namespace MyManabi.OcrWorker;

/// <summary>
/// Cheap, local guess at a question type from candidate text. The result is only a
/// hint for the reviewer; promotion to a real Question JSON type is a human decision.
/// </summary>
public static class QuestionTypeHeuristic
{
    private static readonly Regex Arithmetic =
        new(@"[0-9０-９][ \t　]*[+＋\-－ー−×÷*/=＝][ \t　]*[0-9０-９]",
            RegexOptions.Compiled);

    private static readonly Regex ChoiceLetters =
        new(@"[アイウエオ][ \t　.．)）:：]", RegexOptions.Compiled); // ア イ ウ エ オ + delimiter

    private static readonly Regex ChoosePrompt =
        new(@"選び|選択|正しいもの|あてはまる|当てはまる", RegexOptions.Compiled);

    private static readonly Regex Circled = new(@"[①-⑳]", RegexOptions.Compiled);

    private static readonly Regex Cjk = new(@"[一-鿿]", RegexOptions.Compiled);

    public static string Suggest(string text)
    {
        var t = (text ?? "").Trim();
        if (t.Length == 0) return "unknown";

        if (ChoosePrompt.IsMatch(t) || ChoiceLetters.Matches(t).Count >= 2 || Circled.Matches(t).Count >= 2)
            return "multiple-choice";

        if (Arithmetic.IsMatch(t))
            return "numeric";

        string compact = Regex.Replace(t, @"\s", "");
        if (Cjk.IsMatch(t) && compact.Length <= 16)
            return "kanji";

        return "unknown";
    }
}
