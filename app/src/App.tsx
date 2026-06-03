import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readVariant, setVariantInUrl, VARIANTS, type Variant, type View, type FeedbackStyle } from "./lib/variant";
import { fallbackProblems } from "./data/fallbackProblems";
import type { Question } from "./domain/question";
import { VariantA } from "./features/learner/VariantA";
import { VariantB } from "./features/learner/VariantB";
import { ParentConsole } from "./features/parent/ParentConsole";
import { DeveloperSpike } from "./features/developer/DeveloperSpike";
import { PrototypeSwitcher } from "./components/PrototypeSwitcher";
import "./App.css";

function App() {
  const [variant, setVariant] = useState<Variant>(readVariant);
  const [view, setView] = useState<View>("learner");
  const [problemIndex, setProblemIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [feedbackStyle, setFeedbackStyle] = useState<FeedbackStyle>("inline");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false);
  const [problems, setProblems] = useState<Question[]>(fallbackProblems);
  const [questionBankSource, setQuestionBankSource] = useState("ブラウザ用の合成問題");

  const currentProblem = problems[problemIndex % problems.length];

  useEffect(() => {
    invoke<Question[]>("load_question_bank_for_notes", {
      noteIds: ["fraction-addition"],
    })
      .then((loadedProblems) => {
        if (loadedProblems.length > 0) {
          setProblems(loadedProblems);
          setQuestionBankSource("Obsidian 索引: fraction-addition");
        }
      })
      .catch(() =>
        invoke<Question[]>("load_question_bank")
          .then((loadedProblems) => {
            if (loadedProblems.length > 0) {
              setProblems(loadedProblems);
              setQuestionBankSource("DATA_DIR の確認済み問題");
            }
          })
          .catch(() => {
            // Browser-only preview does not expose Tauri commands.
          }),
      );
  }, []);

  const selectVariant = useCallback((next: Variant) => {
    setVariant(next);
    setVariantInUrl(next);
  }, []);

  const cycleVariant = useCallback((direction: number) => {
    const index = VARIANTS.findIndex((item) => item.id === variant);
    const next = VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length];
    selectVariant(next.id);
  }, [selectVariant, variant]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, [contenteditable='true']") ||
        !["ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        return;
      }
      cycleVariant(event.key === "ArrowRight" ? 1 : -1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycleVariant]);

  function moveToNextProblem(message: string) {
    setNotice(message);
    setAnswer("");
    setFeedbackVisible(false);
    setProblemIndex((value) => value + 1);
  }

  function submitAnswer() {
    setNotice(null);
    setFeedbackVisible(true);
  }

  const learnerProps = {
    answer,
    notice,
    problem: currentProblem,
    questionBankSource,
    setAnswer,
    setNotice,
    feedbackStyle,
    feedbackVisible,
    setFeedbackStyle,
    view,
    setView,
    submitAnswer,
    moveToNextProblem,
  };

  const ActiveVariant = variant === "A" ? VariantA : VariantB;

  return (
    <>
      {view === "parent" ? (
        <ParentConsole variant={variant} setView={setView} />
      ) : (
        <ActiveVariant {...learnerProps} />
      )}

      <button
        className="developer-toggle"
        type="button"
        onClick={() => setShowDeveloperPanel((value) => !value)}
      >
        {showDeveloperPanel ? "開発パネルを閉じる" : "開発パネル"}
      </button>
      {showDeveloperPanel && <DeveloperSpike />}

      {import.meta.env.DEV && (
        <PrototypeSwitcher
          variant={variant}
          cycleVariant={cycleVariant}
          selectVariant={selectVariant}
        />
      )}
    </>
  );
}

export default App;
