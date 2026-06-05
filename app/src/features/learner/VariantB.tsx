import { Header } from "../../components/Header";
import type { LearnerProps } from "./types";
import { AnswerEvidence, QuestionPresentation, responseLabel } from "./QuestionMedia";

export function VariantB(props: LearnerProps) {
  const currentLearner = props.learners.find(l => l.id === props.currentLearnerId);

  return (
    <main className="app-shell home-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="home-grid">
        <div className="learner-workspace">
          <aside className="learner-side-panel">
            <div className="side-card learner-card">
              <span className="avatar">{currentLearner ? currentLearner.name.charAt(0) : "？"}</span>
              <label>
                <span>なまえ</span>
                <select
                  value={props.currentLearnerId}
                  onChange={e => props.setCurrentLearnerId(e.target.value)}
                >
                  {props.learners.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  {props.learners.length === 0 && <option value={props.currentLearnerId}>{props.currentLearnerId}</option>}
                </select>
              </label>
            </div>

            <div className="side-card problem-meta-card">
              <div className="side-meta">
                <span>出題元</span>
                <strong>{props.questionBankSource}</strong>
              </div>
              <div className="side-meta">
                <span>教科</span>
                <strong>{props.problem.subject}</strong>
              </div>
              {props.problem.skillIds.length > 0 && (
                <div className="side-meta">
                  <span>分類</span>
                  <strong>{props.problem.skillIds.join(" / ")}</strong>
                </div>
              )}
              {props.problem.note && <p className="side-note">{props.problem.note}</p>}
            </div>

            {props.notice && <p className="side-notice side-card" role="status">{props.notice}</p>}
          </aside>

          <article className="split-problem">
            <div className="split-question">
              <h2>{props.problem.title}</h2>
              <QuestionPresentation question={props.problem} />
            </div>
            <aside className="split-controls">
            <label className="answer-box horizontal">
              <span>{responseLabel(props.problem)}</span>
              <input
                value={props.answer}
                onChange={(event) => props.setAnswer(event.currentTarget.value)}
                placeholder="入力"
              />
            </label>
            <button className="primary-button" type="button" onClick={props.submitAnswer}>
              こたえる
            </button>
            {props.feedbackVisible && (
              <div className="compact-feedback">
                <strong>{props.feedbackResult === "correct" ? "正解です" : props.feedbackResult === "dont-know" ? "正解はこちらです" : "ちがうみたい"}</strong>
                <AnswerEvidence question={props.problem} />
                <button
                  className="small-button"
                  type="button"
                  onClick={() => props.moveToNextProblem("次の問題を表示しました。")}
                >
                  次の問題
                </button>
              </div>
            )}
            <button
              className="ghost-button"
              type="button"
              onClick={props.onDontKnow}
            >
              分からない
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={props.onDispute}
            >
              答えが違うと思う
            </button>
            </aside>
          </article>
        </div>
      </section>
    </main>
  );
}
