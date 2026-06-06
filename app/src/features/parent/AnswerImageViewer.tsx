import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Question } from "../../domain/question";

type AnswerImageViewerProps = {
  answer: Question["answer"];
  questionId: string;
  onImageClick: (imagePath: string) => void;
};

export function AnswerImageViewer({
  answer,
  questionId,
  onImageClick,
}: AnswerImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImageUrl(null);
    setError(null);
    setLoading(false);

    if (!answer) return;

    // Direct image files
    if (
      (answer.type === "image" || answer.type === "exemplar-image") &&
      answer.imagePath
    ) {
      setImageUrl(convertFileSrc(answer.imagePath));
      return;
    }

    // Source document regions
    if (
      (answer.type === "source-region" || answer.type === "source-page") &&
      answer.documentId &&
      answer.page !== undefined
    ) {
      setLoading(true);
      invoke<string>("get_page_image_path", {
        sourceDocumentId: answer.documentId,
        page: answer.page,
      })
        .then((path) => {
          setImageUrl(convertFileSrc(path));
          setError(null);
        })
        .catch((err) => {
          setError(String(err));
          setImageUrl(null);
        })
        .finally(() => setLoading(false));
    }
  }, [answer]);

  // Don't render for non-image answer types
  if (
    !answer ||
    (answer.type !== "image" &&
      answer.type !== "exemplar-image" &&
      answer.type !== "source-region" &&
      answer.type !== "source-page")
  ) {
    return null;
  }

  if (error) {
    return (
      <div className="image-viewer-section">
        <div className="no-image-placeholder">素材を表示できません</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="image-viewer-section">
        <div className="image-loading">画像を読み込み中...</div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="image-viewer-section">
        <div className="no-image-placeholder">画像がありません</div>
      </div>
    );
  }

  return (
    <div className="image-viewer-section">
      <img
        src={imageUrl}
        alt={`答え画像 (${questionId})`}
        className="image-thumbnail"
        onClick={() => onImageClick(imageUrl)}
      />
      <button
        type="button"
        className="answer-image-view-button"
        onClick={() => onImageClick(imageUrl)}
      >
        答え画像を見る
      </button>
    </div>
  );
}
