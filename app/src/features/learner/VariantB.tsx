import { Header } from "../../components/Header";
import type { LearnerProps } from "./types";
import { AnswerEvidence, QuestionPresentation, responseLabel } from "./QuestionMedia";

export function VariantB(props: LearnerProps) {
  const currentLearner = props.learners.find(l => l.id === props.currentLearnerId);

  const isSingle = props.playableItem.type === "single";
  const singleData: any = isSingle ? props.playableItem.data : null;
  const setData: any = !isSingle ? props.playableItem.data : null;
  const firstQuestionId = setData?.items?.[0]?.questionId;
  const setQuestionTitle = firstQuestionId ? props.getQuestionTitle(firstQuestionId) : undefined;
  const title = isSingle ? singleData.title : (
    setQuestionTitle || (setData?.source?.documentId && setData?.source?.page 
      ? `一括出題 (${setData.source.documentId} P${setData.source.page})` 
      : "一括出題")
  );
  const subject = isSingle ? singleData.subject : "複合";
  const skillIds = isSingle ? singleData.skillIds : [];
  const note = isSingle ? singleData.note : undefined;

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
                <strong>{subject}</strong>
              </div>
              {skillIds.length > 0 && (
                <div className="side-meta">
                  <span>分類</span>
                  <strong>{skillIds.join(" / ")}</strong>
                </div>
              )}
              {note && <p className="side-note">{note}</p>}
            </div>

            {props.todayStats && props.todayStats.attempted > 0 && (
              <div className="side-card stats-card">
                <div className="side-meta">
                  <span>今日の記録</span>
                  <strong>{props.todayStats.attempted} 問</strong>
                </div>
                <div className="side-meta" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ color: 'green' }}>○ {props.todayStats.correct}</span>
                  <span style={{ color: 'red' }}>× {props.todayStats.incorrect}</span>
                </div>
              </div>
            )}

            {props.notice && <p className="side-notice side-card" role="status">{props.notice}</p>}
          </aside>

          <article className="split-problem">
            <div className="split-question">
              <h2 title={title} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
              {isSingle ? (
                <QuestionPresentation question={singleData} />
              ) : (
                <p>QuestionSetの一括表示は VariantA をご利用ください</p>
              )}
            </div>
            <aside className="split-controls">
            <label className="answer-box horizontal">
              <span>{isSingle ? responseLabel(singleData) : "こたえ"}</span>
              <input
                value={isSingle ? (props.answers[singleData.id] || "") : ""}
                onChange={(event) => isSingle && props.setAnswer(singleData.id, event.currentTarget.value)}
                placeholder="入力"
              />
            </label>
            <button className="primary-button" type="button" onClick={props.submitAnswer}>
              こたえる
            </button>
            {props.feedbackVisible && isSingle && (
              <div className="compact-feedback">
                <strong>{props.feedbackResults[singleData.id] === "correct" ? "正解です" : props.feedbackResults[singleData.id] === "dont-know" ? "正解はこちらです" : "ちがうみたい"}</strong>
                <AnswerEvidence question={singleData} />
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
