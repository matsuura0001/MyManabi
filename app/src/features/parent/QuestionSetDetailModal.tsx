import type { Question } from "../../domain/question";
import type { QuestionSet, QuestionSetMaterial } from "../../domain/questionSet";
import { sourceLabel, statusLabel } from "./labels";

type QuestionSetDetailModalProps = {
  questionSet: QuestionSet;
  questions: Question[];
  onClose: () => void;
};

function materialPreview(material: QuestionSetMaterial) {
  if (material.type === "text" && material.text) return material.text;
  if (material.type === "source-region") return "教材画像の指定範囲";
  if (material.type === "source-page") return "教材ページ画像";
  if (material.type === "image") return "画像";
  if (material.type === "audio") return "音声";
  return "素材";
}

export function QuestionSetDetailModal({
  questionSet,
  questions,
  onClose,
}: QuestionSetDetailModalProps) {
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const sortedItems = questionSet.items.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>問題セット詳細</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* ID and Source */}
          <section className="detail-section">
            <h3>基本情報</h3>
            <dl>
              <div>
                <dt>セットID</dt>
                <dd className="dev-id">{questionSet.id}</dd>
              </div>
              <div>
                <dt>出典</dt>
                <dd>{sourceLabel(questionSet.source.type)}</dd>
              </div>
              {questionSet.source.documentId && (
                <div>
                  <dt>ドキュメントID</dt>
                  <dd className="dev-id">{questionSet.source.documentId}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Question Materials */}
          {questionSet.questionMaterials.length > 0 && (
            <section className="detail-section">
              <h3>問題側素材</h3>
              <div className="materials-list">
                {questionSet.questionMaterials.map((material, idx) => (
                  <div key={idx} className="material-item">
                    <span className="material-type">{material.type}</span>
                    <span className="material-preview">{materialPreview(material)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Answer Materials */}
          {questionSet.answerMaterials.length > 0 && (
            <section className="detail-section">
              <h3>回答側素材</h3>
              <div className="materials-list">
                {questionSet.answerMaterials.map((material, idx) => (
                  <div key={idx} className="material-item">
                    <span className="material-type">{material.type}</span>
                    <span className="material-preview">{materialPreview(material)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Items Table */}
          <section className="detail-section">
            <h3>問題一覧 ({sortedItems.length} 問)</h3>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>順序</th>
                  <th>ラベル</th>
                  <th>問題タイトル</th>
                  <th>状態</th>
                  <th>正答</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const question = questionsById.get(item.questionId);
                  const isMissing = !question;

                  return (
                    <tr key={item.questionId} className={isMissing ? "missing-question" : ""}>
                      <td>{item.order}</td>
                      <td>{item.label || "-"}</td>
                      <td className="question-title-cell">
                        {question ? (
                          <span>{question.title}</span>
                        ) : (
                          <span className="missing-id">参照切れ: {item.questionId}</span>
                        )}
                      </td>
                      <td>{question ? statusLabel(question.reviewStatus) : "不明"}</td>
                      <td className="answer-cell">
                        {question?.answer?.value ? (
                          <span>{question.answer.value}</span>
                        ) : (
                          <span className="no-answer">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Missing Questions Warning */}
          {sortedItems.some((item) => !questionsById.get(item.questionId)) && (
            <div className="detail-warning">
              ⚠️ このセットには参照できない問題が含まれています。参照切れを修正してください。
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="text-button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
