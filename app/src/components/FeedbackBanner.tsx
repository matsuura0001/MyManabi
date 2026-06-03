import type { FeedbackStyle } from "../lib/variant";

export function FeedbackBanner({
  expectedAnswer,
  moveToNextProblem,
  setNotice,
  style,
  visible,
}: {
  expectedAnswer: string;
  moveToNextProblem: (message: string) => void;
  setNotice: (value: string | null) => void;
  style: FeedbackStyle;
  visible: boolean;
}) {
  if (!visible || style !== "banner") return null;
  return (
    <aside className="feedback-banner">
      <div>
        <strong>正解です</strong>
        <span>{expectedAnswer}</span>
      </div>
      <button type="button" onClick={() => setNotice("答えがちがうと思う、と記録しました。")}>
        答えがちがうと思う
      </button>
      <button type="button" onClick={() => moveToNextProblem("次の問題を表示しました。")}>
        次の問題
      </button>
    </aside>
  );
}
