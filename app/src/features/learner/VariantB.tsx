import { Header } from "../../components/Header";
import type { LearnerProps } from "./types";
import { AnswerEvidence, QuestionPresentation, responseLabel } from "./QuestionMedia";

export function VariantB(props: LearnerProps) {
  return (
    <main className="app-shell home-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="home-grid">
        <article className="welcome-panel">
          <p className="eyebrow">こんにちは、
             <select 
                value={props.currentLearnerId} 
                onChange={e => props.setCurrentLearnerId(e.target.value)}
                style={{background: 'transparent', border: 'none', fontWeight: 'bold', fontSize: 'inherit', color: 'inherit'}}
              >
                {props.learners.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                {props.learners.length === 0 && <option value={props.currentLearnerId}>{props.currentLearnerId}</option>}
              </select>
          </p>
          <h1>{props.problem.subject}</h1>
          <p>出題元: {props.questionBankSource}</p>
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
      </section>
    </main>
  );
}
