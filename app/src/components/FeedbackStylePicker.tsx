import type { FeedbackStyle } from "../lib/variant";

export function FeedbackStylePicker({
  setStyle,
  style,
}: {
  setStyle: (style: FeedbackStyle) => void;
  style: FeedbackStyle;
}) {
  return (
    <aside className="feedback-style-picker">
      <span>正解表示の比較:</span>
      {(["inline", "banner", "sheet"] as const).map((item) => (
        <button
          className={style === item ? "active" : ""}
          key={item}
          type="button"
          onClick={() => setStyle(item)}
        >
          {item === "inline" ? "カード内" : item === "banner" ? "上部通知" : "次へ確認"}
        </button>
      ))}
    </aside>
  );
}
