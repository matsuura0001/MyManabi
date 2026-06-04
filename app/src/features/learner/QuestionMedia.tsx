import { convertFileSrc } from "@tauri-apps/api/core";
import type { Question } from "../../domain/question";

export function answerLabel(question: Question): string {
  return (
    question.answer.value ??
    question.answer.textValue ??
    question.answer.transcript ??
    question.answer.rubric ??
    (question.answer.type === "manual-review" ? "大人と確認します" : "画像または音声で確認します")
  );
}

export function responseLabel(question: Question): string {
  switch (question.expectedResponse?.type) {
    case "handwriting":
      return "手書きで答え";
    case "speech":
      return "声に出して答え";
    case "drawing":
      return "図や線で答え";
    case "parent-review":
      return "大人と確認";
    case "choice":
      return "選択肢";
    case "numeric":
      return "式とこたえ";
    case "text":
    default:
      return "こたえ";
  }
}

function sourceRegionLabel(item: {
  documentId?: string;
  page?: number;
  region?: { x: number; y: number; width: number; height: number };
}) {
  const region = item.region
    ? `x=${item.region.x.toFixed(2)}, y=${item.region.y.toFixed(2)}, w=${item.region.width.toFixed(2)}, h=${item.region.height.toFixed(2)}`
    : "領域未設定";
  return `${item.documentId ?? "教材"} / page ${item.page ?? "?"} / ${region}`;
}

export function QuestionPresentation({ question }: { question: Question }) {
  const presentation = question.presentation;

  if (!presentation) {
    return <p className="problem-body story-problem">{question.body}</p>;
  }

  if (presentation.type === "text") {
    return <p className="problem-body story-problem">{presentation.text ?? question.body}</p>;
  }

  if (presentation.type === "image" && presentation.imagePath) {
    return (
      <img
        alt={question.title}
        className="question-media-image"
        src={convertFileSrc(presentation.imagePath)}
      />
    );
  }

  if (presentation.type === "audio") {
    return (
      <div className="question-media-box">
        {presentation.mediaId ? <p>音声: {presentation.mediaId}</p> : <p>音声問題</p>}
        {presentation.showTranscript && presentation.transcript && (
          <p className="problem-note">{presentation.transcript}</p>
        )}
      </div>
    );
  }

  if (presentation.type === "source-region") {
    return (
      <div className="question-media-box">
        <strong>教材画像の領域</strong>
        <span>{sourceRegionLabel(presentation)}</span>
      </div>
    );
  }

  return <p className="problem-body story-problem">{question.body ?? question.title}</p>;
}

export function AnswerEvidence({ question }: { question: Question }) {
  const answer = question.answer;
  if ((answer.type === "image" || answer.type === "exemplar-image") && answer.imagePath) {
    return (
      <img
        alt="答え"
        className="answer-media-image"
        src={convertFileSrc(answer.imagePath)}
      />
    );
  }

  if (answer.type === "source-region") {
    return (
      <span>
        {answer.textValue ? `${answer.textValue} / ` : ""}
        {sourceRegionLabel(answer)}
      </span>
    );
  }

  if (answer.type === "audio" || answer.type === "exemplar-audio") {
    return <span>{answer.transcript ?? answer.mediaId ?? "音声で確認します"}</span>;
  }

  return <span>{answerLabel(question)}</span>;
}
