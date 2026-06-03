import { Header } from "../../components/Header";
import { FeedbackBanner } from "../../components/FeedbackBanner";
import type { LearnerProps } from "./types";

export function VariantA(props: LearnerProps) {
  return (
    <main className="app-shell focus-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="focus-stage">
        <div className="learner-strip">
          <span className="avatar">あ</span>
          <div>
            <strong>あおい / 3 もんめ</strong>
          </div>
          <span className="soft-chip">あと 2 もん</span>
        </div>

        {props.notice && <p className="notice">{props.notice}</p>}
        <FeedbackBanner
          style={props.feedbackStyle}
          visible={props.feedbackVisible}
          moveToNextProblem={props.moveToNextProblem}
          setNotice={props.setNotice}
          expectedAnswer={props.problem.answer.value}
        />

        <article className="problem-sheet wide-sheet">
          <div className="problem-copy">
            <p className="eyebrow">
              {props.problem.subject} / {props.problem.skillIds.join(" / ")}
            </p>
            <h1>{props.problem.title}</h1>
            <p className="problem-body story-problem">{props.problem.body}</p>
            <p className="problem-note">{props.problem.note}</p>
          </div>

          {props.feedbackVisible && props.feedbackStyle === "sheet" && (
            <aside className="feedback-sheet">
              <div className="feedback-check">✓</div>
              <div>
                <p className="eyebrow">回答を記録しました</p>
                <h2>正解です</h2>
                <p>{props.problem.answer.value}</p>
              </div>
              <div className="feedback-sheet-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => props.setNotice("答えがちがうと思う、と記録しました。")}
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
              <span>式とこたえ</span>
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
                onClick={() => props.setNotice("解説を表示する画面へ進みます。")}
              >
                分からない
              </button>
            </div>
          </div>

          {props.feedbackVisible && props.feedbackStyle === "inline" && (
            <div className="inline-feedback">
              <div>
                <strong>正解です</strong>
                <span>{props.problem.answer.value}</span>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => props.setNotice("答えがちがうと思う、と記録しました。")}
              >
                答えがちがうと思う
              </button>
            </div>
          )}

          <div className="secondary-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.setNotice("今日はここまで。3 問取り組みました。")}
            >
              今日はここまで
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.setNotice("大人と確認する項目へ追加しました。")}
            >
              大人と確認する
            </button>
          </div>
        </article>
        <small className="question-bank-source">出題元: {props.questionBankSource}</small>
      </section>
    </main>
  );
}
