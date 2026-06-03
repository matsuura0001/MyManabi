import type { View } from "../lib/variant";

export function Header({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <header className="app-header">
      <nav className="view-switch" aria-label="画面切り替え">
        <button
          className={view === "learner" ? "active" : ""}
          type="button"
          onClick={() => setView("learner")}
        >
          学習する
        </button>
        <button
          className={view === "parent" ? "active" : ""}
          type="button"
          onClick={() => setView("parent")}
        >
          おうちの人
        </button>
      </nav>
    </header>
  );
}
