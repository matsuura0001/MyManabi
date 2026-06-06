import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Question } from "../../domain/question";

type SourceImageItem = {
  documentId?: string;
  page?: number;
  region?: { x: number; y: number; width: number; height: number };
};

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

export function SourceRegionImage({ item }: { item: SourceImageItem }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setImageUrl(null);
    setError(null);
    setNaturalSize(null);
    if (item.documentId && item.page) {
      invoke<string>("get_page_image_path", { sourceDocumentId: item.documentId, page: item.page })
        .then(path => setImageUrl(convertFileSrc(path)))
        .catch(err => setError(String(err)));
    }
  }, [item.documentId, item.page]);

  if (error) {
    return <div className="question-media-error">画像を取得できませんでした: {error}</div>;
  }

  if (!imageUrl) {
    return <div className="question-media-loading">画像を読み込み中...</div>;
  }

  const handleExpandToggle = () => setIsExpanded(!isExpanded);

  const renderContent = (expanded: boolean) => {
    if (!item.region) {
      return (
        <img
          src={imageUrl}
          alt="ページ全体"
          className="source-page-image"
          style={{ 
            cursor: expanded ? 'zoom-out' : 'zoom-in', 
            width: expanded ? '90vw' : undefined,
            maxWidth: expanded ? '90vw' : undefined 
          }}
          onLoad={(event) =>
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          onClick={(e) => { e.stopPropagation(); handleExpandToggle(); }}
        />
      );
    }

    const { x, y, width, height } = item.region;
    const pageAspectRatio = naturalSize ? naturalSize.width / naturalSize.height : 1;
    const regionAspectRatio = pageAspectRatio * (width / height);

    return (
      <div
        className={`source-region-frame ${expanded ? 'expanded' : ''}`}
        style={{
          aspectRatio: regionAspectRatio,
          width: expanded ? '90vw' : undefined,
          maxWidth: expanded ? '90vw' : `min(100%, calc(min(64vh, 620px) * ${regionAspectRatio}))`,
          cursor: expanded ? 'zoom-out' : 'zoom-in',
        }}
        onClick={(e) => { e.stopPropagation(); handleExpandToggle(); }}
      >
        <img 
          src={imageUrl} 
          alt="出題領域"
          onLoad={(event) =>
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          style={{
            position: 'absolute',
            top: `-${(y / height) * 100}%`,
            left: `-${(x / width) * 100}%`,
            width: `${(1 / width) * 100}%`,
            height: 'auto',
            maxWidth: 'none'
          }} 
        />
      </div>
    );
  };

  return (
    <>
      {renderContent(false)}
      {isExpanded && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2rem',
            overflow: 'auto'
          }}
          onClick={handleExpandToggle}
        >
          {renderContent(true)}
        </div>
      )}
    </>
  );
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

  if (presentation.type === "source-region" || presentation.type === "source-page") {
    return (
      <div className="question-media-box" style={{ padding: 0, border: 'none', background: 'transparent' }}>
        <SourceRegionImage item={presentation} />
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

  if (answer.type === "source-region" || answer.type === "source-page") {
    return (
      <div style={{ marginTop: '1rem' }}>
        {answer.textValue && <p><strong>{answer.textValue}</strong></p>}
        <div style={{ maxWidth: '400px' }}>
          <SourceRegionImage item={answer} />
        </div>
      </div>
    );
  }

  if (answer.type === "audio" || answer.type === "exemplar-audio") {
    return <span>{answer.transcript ?? answer.mediaId ?? "音声で確認します"}</span>;
  }

  return <span>{answerLabel(question)}</span>;
}
