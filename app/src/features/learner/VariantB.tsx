import { Header } from "../../components/Header";
import type { LearnerProps } from "./types";
import { AnswerEvidence, QuestionPresentation, responseLabel } from "./QuestionMedia";

export function VariantB(props: LearnerProps) {
  return (
    <main className="app-shell home-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="home-grid">
        <article className="welcome-panel">
          <p className="eyebrow">こんにちは、あおい</p>
          <h1>分数のたし算</h1>
          <p>前回の続き / 7 問まで完了</p>
          <button
            className="primary-button large"
            type="button"
            onClick={() => props.setNotice("前回の続きから始めます。")}
          >
            前回のつづき
          </button>
        </article>

        <article className="message-panel">
          <p className="eyebrow">おうちの人から</p>
          <p className="message-copy">分数の問題を 1 問だけ確認してみたいです。</p>
          <div className="inline-actions">
            <button
              className="small-button"
              type="button"
              onClick={() => props.setNotice("確認問題を最初に表示します。")}
            >
              やってみる
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => props.setNotice("あとで確認できるようにしました。")}
            >
              あとで
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => props.setNotice("今は解きたくないと伝えました。")}
            >
              今はやらない
            </button>
          </div>
        </article>

        {props.notice && <p className="notice wide">{props.notice}</p>}

        <article className="split-problem">
          <div className="split-question">
            <p className="eyebrow">
              {props.problem.subject} / {props.problem.skillIds.join(" / ")}
            </p>
            <h2>{props.problem.title}</h2>
            <QuestionPresentation question={props.problem} />
            <p className="problem-note">{props.problem.note}</p>
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
                <strong>正解です</strong>
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
              onClick={() => props.setNotice("解説を表示する画面へ進みます。")}
            >
              分からない
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.setNotice("今日はここまで。取り組んだ内容を記録しました。")}
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
          </aside>
        </article>
      </section>
    </main>
  );
}
