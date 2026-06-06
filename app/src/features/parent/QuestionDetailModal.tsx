import { useState } from "react";
import type { Question } from "../../domain/question";
import type { QuestionSet } from "../../domain/questionSet";
import { ProblemImageViewer } from "./ProblemImageViewer";
import { AnswerImageViewer } from "./AnswerImageViewer";
import { ImageLightbox } from "./ImageLightbox";

type QuestionDetailModalProps = {
  question: Question;
  parentQuestionSet: QuestionSet | undefined;
  onClose: () => void;
};

function sourceLabel(sourceType: Question["source"]["type"]) {
  switch (sourceType) {
    case "adult-authored":
      return "手作成";
    case "ai-generated":
      return "AI生成";
    case "local-generated":
      return "端末生成";
    case "imported":
      return "取り込み";
  }
}

function statusLabel(status: Question["reviewStatus"]) {
  switch (status) {
    case "adult-approved":
      return "承認済み";
    case "auto-approved":
      return "自動承認";
    case "draft":
      return "下書き";
    case "suspended":
      return "停止中";
  }
}

function purposeLabel(purpose: string) {
  switch (purpose) {
    case "learning":
      return "学習";
    case "review":
      return "復習";
    case "assessment":
      return "測定";
    default:
      return purpose;
  }
}

function questionTypeLabel(type: string) {
  switch (type) {
    case "numeric":
      return "数値回答";
    case "kanji":
      return "漢字";
    case "multiple-choice":
      return "選択肢";
    case "word-problem":
      return "応用問題";
    case "free-text":
      return "自由記述";
    case "handwriting":
      return "手書き";
    case "speech":
      return "音声";
    default:
      return type;
  }
}

function expectedResponseLabel(type: string) {
  switch (type) {
    case "text":
      return "テキスト";
    case "numeric":
      return "数値";
    case "choice":
      return "選択肢";
    case "handwriting":
      return "手書き";
    case "speech":
      return "音声";
    case "drawing":
      return "描画";
    case "parent-review":
      return "保護者レビュー";
    default:
      return type;
  }
}

export function QuestionDetailModal({
  question,
  parentQuestionSet,
  onClose,
}: QuestionDetailModalProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>問題詳細</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Problem Section */}
          <section className="detail-section">
            <h3>問題</h3>
            <dl>
              <div>
                <dt>タイトル</dt>
                <dd>{question.title}</dd>
              </div>
              {question.body && (
                <div>
                  <dt>問題文</dt>
                  <dd className="multiline">{question.body}</dd>
                </div>
              )}
              {question.presentation && (
                <div>
                  <dt>提示方法</dt>
                  <dd>
                    {question.presentation.type === "text" && question.presentation.text && (
                      <span>{question.presentation.text}</span>
                    )}
                    {question.presentation.type === "source-region" && (
                      <span>教材画像の指定範囲を表示します</span>
                    )}
                    {question.presentation.type === "source-page" && (
                      <span>教材ページ画像を表示します</span>
                    )}
                    {question.presentation.type === "image" && <span>画像問題です</span>}
                    {question.presentation.type === "audio" && <span>音声問題です</span>}
                  </dd>
                </div>
              )}
            </dl>

            {/* Problem Image Viewer */}
            <ProblemImageViewer
              presentation={question.presentation}
              questionId={question.id}
              onImageClick={setLightboxImage}
            />
          </section>

          {/* Answer Section */}
          <section className="detail-section">
            <h3>正答</h3>
            <dl>
              <div>
                <dt>答えタイプ</dt>
                <dd>{question.answer.type}</dd>
              </div>
              {question.answer.value && (
                <div>
                  <dt>答え値</dt>
                  <dd className="answer-value-display">
                    <strong>{question.answer.value}</strong>
                  </dd>
                </div>
              )}
              {question.answer.textValue && (
                <div>
                  <dt>答えテキスト</dt>
                  <dd className="multiline">{question.answer.textValue}</dd>
                </div>
              )}
              {question.answer.acceptedAnswers && question.answer.acceptedAnswers.length > 0 && (
                <div>
                  <dt>許容される答え</dt>
                  <dd>
                    <ul className="accepted-answers-list">
                      {question.answer.acceptedAnswers.map((ans, idx) => (
                        <li key={idx}>{ans}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {question.answer.rubric && (
                <div>
                  <dt>採点基準</dt>
                  <dd className="multiline">{question.answer.rubric}</dd>
                </div>
              )}
            </dl>

            {/* Answer Image Viewer */}
            <AnswerImageViewer
              answer={question.answer}
              questionId={question.id}
              onImageClick={setLightboxImage}
            />
          </section>

          {/* Metadata Section */}
          <section className="detail-section">
            <h3>メタデータ</h3>
            <dl>
              <div>
                <dt>教科</dt>
                <dd>{question.subject}</dd>
              </div>
              <div>
                <dt>単元</dt>
                <dd>{question.unitId}</dd>
              </div>
              {question.skillIds.length > 0 && (
                <div>
                  <dt>スキル</dt>
                  <dd>
                    <ul className="skill-list">
                      {question.skillIds.map((skillId) => (
                        <li key={skillId}>{skillId}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              <div>
                <dt>問題タイプ</dt>
                <dd>
                  {questionTypeLabel(question.questionType)} <span className="internal-value">({question.questionType})</span>
                </dd>
              </div>
              {question.expectedResponse && (
                <div>
                  <dt>期待される回答形式</dt>
                  <dd>
                    {expectedResponseLabel(question.expectedResponse.type)}{" "}
                    <span className="internal-value">({question.expectedResponse.type})</span>
                  </dd>
                </div>
              )}
              <div>
                <dt>用途</dt>
                <dd>
                  {question.purposes && question.purposes.length > 0
                    ? question.purposes.map(purposeLabel).join(" / ")
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>

          {/* Review Section */}
          <section className="detail-section">
            <h3>確認状態</h3>
            <dl>
              <div>
                <dt>ステータス</dt>
                <dd>{statusLabel(question.reviewStatus)}</dd>
              </div>
              {question.note && (
                <div>
                  <dt>メモ</dt>
                  <dd className="multiline">{question.note}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Source Section */}
          <section className="detail-section">
            <h3>出典</h3>
            <dl>
              <div>
                <dt>出典タイプ</dt>
                <dd>{sourceLabel(question.source.type)}</dd>
              </div>
              {question.source.documentId && (
                <div>
                  <dt>ドキュメントID</dt>
                  <dd className="dev-id">{question.source.documentId}</dd>
                </div>
              )}
              {question.source.page !== undefined && (
                <div>
                  <dt>ページ</dt>
                  <dd>{question.source.page}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Parent QuestionSet */}
          {parentQuestionSet && (
            <section className="detail-section">
              <h3>所属セット</h3>
              <dl>
                <div>
                  <dt>セットID</dt>
                  <dd className="dev-id">{parentQuestionSet.id}</dd>
                </div>
              </dl>
            </section>
          )}

          {/* ID Section (Developer) */}
          <section className="detail-section detail-section--dev">
            <h3>内部ID</h3>
            <dl>
              <div>
                <dt>問題ID</dt>
                <dd className="dev-id">{question.id}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="modal-footer">
          <button className="text-button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        imagePath={lightboxImage}
        alt={`問題画像: ${question.title}`}
        label="問題画像"
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
