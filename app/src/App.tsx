import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readVariant, type Variant, type View, type FeedbackStyle } from "./lib/variant";
import { fallbackProblems } from "./data/fallbackProblems";
import type { Question } from "./domain/question";
import type { Learner, QuestionQueueItem, LearningEvent } from "./domain/learner";
import { VariantA } from "./features/learner/VariantA";
import { VariantB } from "./features/learner/VariantB";
import { ParentConsole } from "./features/parent/ParentConsole";
import { DeveloperSpike } from "./features/developer/DeveloperSpike";
import "./App.css";

function App() {
  const [variant] = useState<Variant>(readVariant);
  const [view, setView] = useState<View>("learner");
  
  const [learners, setLearners] = useState<Learner[]>([]);
  const [currentLearnerId, setCurrentLearnerId] = useState<string>("learner-a");
  const [problemIndex, setProblemIndex] = useState(0);
  
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const feedbackStyle: FeedbackStyle = "sheet";
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false);
  const [problems, setProblems] = useState<Question[]>(fallbackProblems);
  const [questionBankSource, setQuestionBankSource] = useState("ブラウザ用の合成問題");

  const currentProblem = problems.length > 0 ? problems[problemIndex % problems.length] : fallbackProblems[0];

  // Fetch learners
  useEffect(() => {
    invoke<Learner[]>("list_learners")
      .then((data) => {
        setLearners(data);
        if (data.length > 0 && !data.find(l => l.id === currentLearnerId)) {
           setCurrentLearnerId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch Question Queue
  useEffect(() => {
    invoke<QuestionQueueItem[]>("get_question_queue", { learnerId: currentLearnerId })
      .then((items) => {
         return invoke<Question[]>("load_question_bank").then(loaded => {
             const mapped = items.map(item => loaded.find(q => q.id === item.questionId)).filter(Boolean) as Question[];
             if (mapped.length > 0) {
                 setProblems(mapped);
                 setQuestionBankSource(`待機列 (${mapped.length}問)`);
                 setProblemIndex(0);
             } else {
                 setProblems(fallbackProblems);
                 setQuestionBankSource("待機列は空です。合成問題を表示します。");
             }
         });
      })
      .catch((err) => {
         console.warn("Failed to load queue, falling back to all questions", err);
         invoke<Question[]>("load_question_bank")
            .then((loadedProblems) => {
              if (loadedProblems.length > 0) {
                setProblems(loadedProblems);
                setQuestionBankSource("DATA_DIR の確認済み問題");
              }
            }).catch(console.error);
      });
  }, [currentLearnerId]);

  function handleLearnerChange(id: string) {
    if (id !== currentLearnerId) {
      setProblems([]); // Clear problems to prevent submitting answers for the new learner on the old question
      setProblemIndex(0);
      setAnswer("");
      setNotice(null);
      setFeedbackVisible(false);
      setQuestionBankSource("読み込み中...");
      setCurrentLearnerId(id);
    }
  }

  function sendLearningEvent(
    responseType: "text" | "none",
    method: "deterministic" | "not-graded",
    result: "correct" | "unknown",
    flags: { did_not_know?: boolean; disputed?: boolean; anxious?: boolean } = {}
  ) {
    if (!currentProblem) return;
    
    const event: LearningEvent = {
        schema_version: 2,
        event_id: crypto.randomUUID(),
        occurred_at: new Date().toISOString(),
        learner_id: currentLearnerId,
        unit: currentProblem.unitId || "unknown",
        template_id: currentProblem.source?.templateId || "default",
        question: currentProblem.id,
        response: {
            type: responseType,
            text: responseType === "text" ? answer : undefined,
        },
        grading: {
            result,
            method,
            reason: ""
        },
        duration_seconds: 15, // Placeholder
        flags: {
            did_not_know: !!flags.did_not_know,
            disputed: !!flags.disputed,
            anxious: !!flags.anxious,
        },
        explanations: [],
        adult_review_required: false,
    };
    invoke("save_learning_event", { event }).catch(console.error);
  }

  function moveToNextProblem(message: string) {
    setNotice(message);
    setAnswer("");
    setFeedbackVisible(false);
    setProblemIndex((value) => value + 1);
  }

  function submitAnswer() {
    setNotice(null);
    setFeedbackVisible(true);
    sendLearningEvent("text", "not-graded", "unknown");
  }

  function handleDontKnow() {
    setNotice("解説を表示する画面へ進みます。");
    sendLearningEvent("none", "not-graded", "unknown", { did_not_know: true });
  }

  function handleDispute() {
    setNotice("答えがちがうと思う、と記録しました。");
    sendLearningEvent("none", "not-graded", "unknown", { disputed: true });
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
    view,
    setView,
    submitAnswer,
    moveToNextProblem,
    onDontKnow: handleDontKnow,
    onDispute: handleDispute,
    learners,
    currentLearnerId,
    setCurrentLearnerId: handleLearnerChange,
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

    </>
  );
}

export default App;
