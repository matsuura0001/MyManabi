import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readVariant, type Variant, type View, type FeedbackStyle } from "./lib/variant";
import { fallbackProblems } from "./data/fallbackProblems";
import type { Question } from "./domain/question";
import type { QuestionSet } from "./domain/questionSet";
import type { Learner, QuestionQueueItem, LearningEvent } from "./domain/learner";
import { expectedAnswerForQuestion, questionSetExpectedAnswers } from "./domain/importReview.mjs";
import type { PlayableItem } from "./features/learner/types";
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
  
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const feedbackStyle: FeedbackStyle = "sheet";
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackResults, setFeedbackResults] = useState<Record<string, "correct" | "incorrect" | "dont-know">>({});
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false);
  const [problems, setProblems] = useState<PlayableItem[]>(fallbackProblems.map(q => ({ type: "single", data: q })));
  const [questionBankSource, setQuestionBankSource] = useState("ブラウザ用の合成問題");
  // 答え合わせ用にすべてのQuestionを保持しておく
  const [allQuestions, setAllQuestions] = useState<Question[]>(fallbackProblems);

  const currentProblem = problems.length > 0 ? problems[problemIndex % problems.length] : problems[0];

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

  // Fetch Question Queue and QuestionBank
  useEffect(() => {
    Promise.all([
      invoke<Question[]>("load_question_bank").catch(() => fallbackProblems),
      invoke<QuestionSet[]>("load_question_sets").catch((err) => {
        setNotice(`Failed to load QuestionSets: ${err}`);
        return [] as QuestionSet[];
      })
    ]).then(([loadedQuestions, loadedSets]) => {
      console.log("Loaded sets count:", loadedSets.length, loadedSets);
      setAllQuestions(loadedQuestions);
      
      const setMemberIds = new Set<string>();
      loadedSets.forEach(set => set.items.forEach(item => setMemberIds.add(item.questionId)));

      invoke<QuestionQueueItem[]>("get_question_queue", { learnerId: currentLearnerId })
        .then((items) => {
          if (items.length > 0) {
            const mapped: PlayableItem[] = [];
            const mappedSetIds = new Set<string>();
            
            items.forEach(item => {
               // 1. キューのIDが "set-..." の場合
               const foundSet = loadedSets.find(s => s.id === item.questionId);
               if (foundSet) {
                   if (!mappedSetIds.has(foundSet.id)) {
                       mapped.push({ type: "set", data: foundSet });
                       mappedSetIds.add(foundSet.id);
                   }
                   return;
               }
               // 2. キューのIDが古い単一QuestionのIDであっても、対応するQuestionSetが存在する場合
               const matchingSetId = `set-${item.questionId}`;
               const matchedSet = loadedSets.find(s => s.id === matchingSetId);
               if (matchedSet) {
                   if (!mappedSetIds.has(matchedSet.id)) {
                       mapped.push({ type: "set", data: matchedSet });
                       mappedSetIds.add(matchedSet.id);
                   }
                   return;
               }
               // 3. キューのIDが小問のID(-itemN)の場合
               const parentSet = loadedSets.find(s => s.items.some(i => i.questionId === item.questionId));
               if (parentSet) {
                   if (!mappedSetIds.has(parentSet.id)) {
                       mapped.push({ type: "set", data: parentSet });
                       mappedSetIds.add(parentSet.id);
                   }
                   return;
               }
               // 4. どれにも当てはまらなければ単一Question
               const foundQ = loadedQuestions.find(q => q.id === item.questionId);
               if (foundQ) { mapped.push({ type: "single", data: foundQ }); }
            });

            // デバッグのため、強制的にすべての QuestionSet を先頭に追加する
            const forceSets: PlayableItem[] = loadedSets.map(s => ({ type: "set", data: s }));
            const finalMapped = forceSets.length > 0 ? [...forceSets, ...mapped] : mapped;

            if (finalMapped.length > 0) {
              setProblems(finalMapped);
              setQuestionBankSource(`待機列+強制Set (${finalMapped.length}件)`);
              setProblemIndex(0);
            } else {
              fallback(loadedQuestions, loadedSets, setMemberIds);
            }
          } else {
            fallback(loadedQuestions, loadedSets, setMemberIds);
          }
        })
        .catch((err) => {
           console.warn("Failed to load queue, falling back to all questions", err);
           fallback(loadedQuestions, loadedSets, setMemberIds);
        });
    });

    function fallback(qs: Question[], sets: QuestionSet[], memberIds: Set<string>) {
      const items: PlayableItem[] = [];
      sets.forEach(s => items.push({ type: "set", data: s }));
      qs.filter(q => !memberIds.has(q.id)).forEach(q => items.push({ type: "single", data: q }));
      
      if (items.length > 0) {
        setProblems(items);
        setQuestionBankSource(`DATA_DIR (${sets.length} Sets, ${items.length - sets.length} Qs)`);
      } else {
        setProblems(fallbackProblems.map(q => ({ type: "single", data: q })));
        setQuestionBankSource("待機列・データともに空です。合成問題を表示します。");
      }
      setProblemIndex(0);
    }
  }, [currentLearnerId]);

  function handleLearnerChange(id: string) {
    if (id !== currentLearnerId) {
      setProblems([]); // Clear problems to prevent submitting answers for the new learner on the old question
      setProblemIndex(0);
      setAnswers({});
      setNotice(null);
      setFeedbackVisible(false);
      setFeedbackResults({});
      setQuestionBankSource("読み込み中...");
      setCurrentLearnerId(id);
    }
  }

  function sendLearningEvent(
    questionId: string,
    unitId: string,
    templateId: string,
    answerText: string,
    responseType: "text" | "none",
    method: "deterministic" | "not-graded",
    result: "correct" | "incorrect" | "unknown",
    flags: { did_not_know?: boolean; disputed?: boolean; anxious?: boolean } = {}
  ) {
    const event: LearningEvent = {
        schema_version: 2,
        event_id: crypto.randomUUID(),
        occurred_at: new Date().toISOString(),
        learner_id: currentLearnerId,
        unit: unitId || "unknown",
        template_id: templateId || "default",
        question: questionId,
        response: {
            type: responseType,
            text: responseType === "text" ? answerText : undefined,
        },
        grading: {
            result: result === "incorrect" ? "unknown" : result, // schema assumes 'unknown' for incorrect currently based on old code
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
    setAnswers({});
    setFeedbackVisible(false);
    setFeedbackResults({});
    setProblemIndex((value) => value + 1);
  }

  function submitAnswer() {
    setNotice(null);
    if (!currentProblem) return;

    const newResults: Record<string, "correct" | "incorrect" | "dont-know"> = {};

    if (currentProblem.type === "single") {
      const q = currentProblem.data;
      const expected = expectedAnswerForQuestion(q);
      const ans = answers[q.id] || "";
      const isCorrect = ans.trim() === expected.trim();
      newResults[q.id] = isCorrect ? "correct" : "incorrect";
      sendLearningEvent(q.id, q.unitId || "", q.source?.templateId || "", ans, "text", "deterministic", isCorrect ? "correct" : "incorrect");
    } else {
      // QuestionSet: Parse the multi-line answer
      const fullAnswer = answers[currentProblem.data.id] || "";
      const lines = fullAnswer.split('\n');
      const expectedAnswers = questionSetExpectedAnswers(currentProblem.data, allQuestions);
      
      for (let i = 0; i < currentProblem.data.items.length; i++) {
        const item = currentProblem.data.items[i];
        const q = allQuestions.find(q => q.id === item.questionId);
        if (q) {
          const expected = expectedAnswers[i]?.value ?? "";
          
          // Try to extract answer from `問X [ ans ]` or fallback to the whole line
          let ans = "";
          const line = lines[i] || "";
          const match = line.match(/\[(.*?)\]/);
          if (match) {
            ans = match[1].trim();
          } else {
            ans = line.replace(/^問\d+\s*/, '').trim();
          }
          
          const isCorrect = ans === expected.trim();
          newResults[item.questionId] = isCorrect ? "correct" : "incorrect";
          sendLearningEvent(q.id, q.unitId || "", q.source?.templateId || "", ans, "text", "deterministic", isCorrect ? "correct" : "incorrect");
        }
      }
    }
    
    setFeedbackResults(newResults);
    setFeedbackVisible(true);
  }

  function handleDontKnow() {
    setNotice("解説を表示します。");
    const newResults: Record<string, "dont-know"> = {};
    if (currentProblem.type === "single") {
      const q = currentProblem.data;
      newResults[q.id] = "dont-know";
      sendLearningEvent(q.id, q.unitId || "", q.source?.templateId || "", "", "none", "not-graded", "unknown", { did_not_know: true });
    } else {
      for (const item of currentProblem.data.items) {
         newResults[item.questionId] = "dont-know";
         const q = allQuestions.find(x => x.id === item.questionId);
         if (q) {
            sendLearningEvent(q.id, q.unitId || "", q.source?.templateId || "", "", "none", "not-graded", "unknown", { did_not_know: true });
         }
      }
    }
    setFeedbackResults(newResults);
    setFeedbackVisible(true);
  }

  function handleDispute() {
    if (currentProblem.type === "single") {
      const q = currentProblem.data;
      sendLearningEvent(q.id, q.unitId || "", q.source?.templateId || "", "", "none", "not-graded", "unknown", { disputed: true });
    } else {
      for (const item of currentProblem.data.items) {
         const q = allQuestions.find(x => x.id === item.questionId);
         if (q) sendLearningEvent(q.id, q.unitId || "", q.source?.templateId || "", "", "none", "not-graded", "unknown", { disputed: true });
      }
    }
    moveToNextProblem("答えがちがうと思う、と記録し次の問題へ進みました。");
  }

  const learnerProps = {
    answers,
    notice,
    playableItem: currentProblem,
    questionBankSource,
    setAnswer: (id: string, value: string) => setAnswers(prev => ({ ...prev, [id]: value })),
    setNotice,
    feedbackStyle,
    feedbackVisible,
    feedbackResults,
    view,
    setView,
    submitAnswer,
    moveToNextProblem,
    onDontKnow: handleDontKnow,
    onDispute: handleDispute,
    learners,
    currentLearnerId,
    setCurrentLearnerId: handleLearnerChange,
    getQuestionTitle: (id: string) => allQuestions.find(q => q.id === id)?.title,
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
