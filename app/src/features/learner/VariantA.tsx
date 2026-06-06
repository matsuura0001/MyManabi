import { Header } from "../../components/Header";
import { FeedbackBanner } from "../../components/FeedbackBanner";
import type { LearnerProps } from "./types";
import { SourceRegionImage, AnswerEvidence, answerLabel, QuestionPresentation, responseLabel } from "./QuestionMedia";
import { LineGutterTextarea } from "../../components/LineGutterTextarea";

export function VariantA(props: LearnerProps) {
  const currentLearner = props.learners.find(l => l.id === props.currentLearnerId);

  const isSingle = props.playableItem.type === "single";
  const singleData: any = isSingle ? props.playableItem.data : null;
  const setData: any = !isSingle ? props.playableItem.data : null;
  const orderedItems = setData?.items ? [...setData.items].sort((a: any, b: any) => (a.order || 0) - (b.order || 0)) : [];
  
  // 共通のメタデータ
  const firstQuestionId = orderedItems[0]?.questionId;
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
    <main className="app-shell focus-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="focus-stage">
        <FeedbackBanner
          style={props.feedbackStyle}
          visible={props.feedbackVisible}
          moveToNextProblem={props.moveToNextProblem}
          setNotice={props.setNotice}
          expectedAnswer={isSingle ? answerLabel(singleData) : "一括出題の答え合わせ完了"}
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

          <article className="problem-sheet wide-sheet">
            <div className="problem-main">
              <div className="problem-copy">
                <h1 title={title} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
                {isSingle ? (
                  <QuestionPresentation question={singleData} />
                ) : (
                  <div className="questionset-materials">
                    {setData.questionMaterials.map((m: any, i: number) => {
                      if (m.type === "source-region" || m.type === "source-page") {
                        return <SourceRegionImage key={i} item={m as any} />;
                      }
                      return <p key={i}>{m.text || m.type}</p>;
                    })}
                  </div>
                )}
              </div>

              {props.feedbackVisible && props.feedbackStyle === "sheet" && (
                <aside className="feedback-sheet">
                  {isSingle ? (
                    <>
                      <div className="feedback-check">
                        {props.feedbackResults[singleData.id] === "correct" ? "✓" : "×"}
                      </div>
                      <div>
                        <p className="eyebrow">回答を記録しました</p>
                        <h2>{props.feedbackResults[singleData.id] === "correct" ? "正解です" : props.feedbackResults[singleData.id] === "dont-know" ? "正解はこちらです" : "ちがうみたい"}</h2>
                        <p><AnswerEvidence question={singleData} /></p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="eyebrow">一括回答を記録しました</p>
                      <h2>
                        {(() => {
                          const correctCount = orderedItems.filter((item: any) => props.feedbackResults[item.questionId] === "correct").length;
                          const totalCount = orderedItems.length;
                          const dontKnowCount = orderedItems.filter((item: any) => props.feedbackResults[item.questionId] === "dont-know").length;
                          if (correctCount === totalCount) return "全問正解です！";
                          if (dontKnowCount === totalCount) return "正解はこちらです";
                          return `${totalCount}問中 ${correctCount}問正解です`;
                        })()}
                      </h2>
                      {setData.answerMaterials?.length > 0 && (
                        <div className="questionset-answer-materials" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {setData.answerMaterials.map((m: any, i: number) => {
                            if (m.type === "source-region" || m.type === "source-page") {
                              return (
                                <div key={i} style={{ maxWidth: '400px' }}>
                                  <SourceRegionImage item={m as any} />
                                </div>
                              );
                            }
                            return <p key={i}>{m.text || m.type}</p>;
                          })}
                        </div>
                      )}
                    </div>
                  )}
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

              <div className="answer-row-container" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                {isSingle ? (
                  <div className="answer-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <label className="answer-box" style={{ width: '100%' }}>
                      {responseLabel(singleData) !== "こたえ" && <span>{responseLabel(singleData)}</span>}
                      <textarea
                        autoFocus
                        value={props.answers[singleData.id] || ""}
                        onChange={(event) => props.setAnswer(singleData.id, event.currentTarget.value)}
                        placeholder="ここに入力"
                        rows={3}
                        style={{ width: '100%' }}
                      />
                    </label>
                    {props.feedbackVisible && props.feedbackStyle === "inline" && (
                      <div className="inline-feedback-mini" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: props.feedbackResults[singleData.id] === "correct" ? "green" : "red" }}>
                          {props.feedbackResults[singleData.id] === "correct" ? "✓" : props.feedbackResults[singleData.id] === "dont-know" ? "？" : "×"}
                        </span>
                        <AnswerEvidence question={singleData} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="answer-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem', flex: 1 }}>
                    <div className="answer-box" style={{ width: '100%' }}>
                      <LineGutterTextarea
                        labels={orderedItems.map((item: any, index: number) => item.label?.trim() || `問${index + 1}`)}
                        value={props.answers[setData.id] || ""}
                        onChange={(value) => props.setAnswer(setData.id, value)}
                        minRows={Math.max(3, orderedItems.length)}
                        autoFocus={true}
                      />
                    </div>
                    {props.feedbackVisible && props.feedbackStyle === "inline" && (
                      <div className="inline-feedback-mini" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {orderedItems.map((item: any, index: number) => (
                           <div key={item.questionId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                             <span>問{index + 1}: </span>
                             <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: props.feedbackResults[item.questionId] === "correct" ? "green" : "red" }}>
                               {props.feedbackResults[item.questionId] === "correct" ? "✓" : props.feedbackResults[item.questionId] === "dont-know" ? "？" : "×"}
                             </span>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="answer-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch' }}>
                  <button
                    className="primary-button answer-submit"
                    type="button"
                    style={{ whiteSpace: 'nowrap' }}
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
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={props.onDontKnow}
                  >
                    分からない
                  </button>
                </div>
              </div>

              {props.feedbackVisible && props.feedbackStyle === "inline" && (
                <div className="inline-feedback" style={{ marginTop: '1rem' }}>
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
