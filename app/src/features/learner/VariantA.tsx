import { Header } from "../../components/Header";
import { FeedbackBanner } from "../../components/FeedbackBanner";
import type { LearnerProps } from "./types";
import { AnswerEvidence, answerLabel, QuestionPresentation, responseLabel } from "./QuestionMedia";

export function VariantA(props: LearnerProps) {
  const currentLearner = props.learners.find(l => l.id === props.currentLearnerId);

  return (
    <main className="app-shell focus-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="focus-stage">
        <FeedbackBanner
          style={props.feedbackStyle}
          visible={props.feedbackVisible}
          moveToNextProblem={props.moveToNextProblem}
          setNotice={props.setNotice}
          expectedAnswer={answerLabel(props.problem)}
        />

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

          <article className="problem-sheet wide-sheet">
            <div className="problem-main">
              <div className="problem-copy">
                <h1>{props.problem.title}</h1>
                <QuestionPresentation question={props.problem} />
              </div>

              {props.feedbackVisible && props.feedbackStyle === "sheet" && (
                <aside className="feedback-sheet">
                  <div className="feedback-check">
                    {props.feedbackResult === "correct" ? "✓" : "×"}
                  </div>
                  <div>
                    <p className="eyebrow">回答を記録しました</p>
                    <h2>{props.feedbackResult === "correct" ? "正解です" : props.feedbackResult === "dont-know" ? "正解はこちらです" : "ちがうみたい"}</h2>
                    <p><AnswerEvidence question={props.problem} /></p>
                  </div>
                  <div className="feedback-sheet-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={props.onDispute}
                    >
                      答えがちがうと思う
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => props.moveToNextProblem("次の問題を表示しました。")}
                    >
                      次の問題
                    </button>
                  </div>
                </aside>
              )}

              <div className="answer-row">
                <label className="answer-box">
                  <span>{responseLabel(props.problem)}</span>
                  <input
                    autoFocus
                    value={props.answer}
                    onChange={(event) => props.setAnswer(event.currentTarget.value)}
                    placeholder="ここに入力"
                  />
                </label>
                <div className="answer-actions">
                  <button
                    className="primary-button answer-submit"
                    type="button"
                    onClick={
                      props.feedbackVisible && props.feedbackStyle === "inline"
                        ? () => props.moveToNextProblem("次の問題を表示しました。")
                        : props.submitAnswer
                    }
                  >
                    {props.feedbackVisible && props.feedbackStyle === "inline" ? "次の問題" : "こたえる"}
                  </button>
                  <button
                    className="ghost-button answer-submit"
                    type="button"
                    onClick={props.onDontKnow}
                  >
                    分からない
                  </button>
                </div>
              </div>

              {props.feedbackVisible && props.feedbackStyle === "inline" && (
                <div className="inline-feedback">
                  <div>
                    <strong>{props.feedbackResult === "correct" ? "正解です" : props.feedbackResult === "dont-know" ? "正解はこちらです" : "ちがうみたい"}</strong>
                    <AnswerEvidence question={props.problem} />
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={props.onDispute}
                  >
                    答えがちがうと思う
                  </button>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
