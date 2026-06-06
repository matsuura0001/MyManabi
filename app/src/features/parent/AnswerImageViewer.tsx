import type { Question } from "../../domain/question";
import { useImageUrl } from "./useImageUrl";

type AnswerImageViewerProps = {
  answer: Question["answer"];
  questionId: string;
  onImageClick: (imagePath: string) => void;
};

function toImageSource(
  answer: Question["answer"]
): Parameters<typeof useImageUrl>[0] {
  if (!answer) return null;
  if ((answer.type === "image" || answer.type === "exemplar-image") && answer.imagePath)
    return { kind: "file", path: answer.imagePath };
  if (
    (answer.type === "source-region" || answer.type === "source-page") &&
    answer.documentId &&
    answer.page !== undefined
  )
    return { kind: "page", documentId: answer.documentId, page: answer.page };
  return null;
}

const IMAGE_ANSWER_TYPES = new Set(["image", "exemplar-image", "source-region", "source-page"]);

export function AnswerImageViewer({
  answer,
  questionId,
  onImageClick,
}: AnswerImageViewerProps) {
  const { imageUrl, loading, error } = useImageUrl(toImageSource(answer));

  // Don't render for non-image answer types
  if (!answer || !IMAGE_ANSWER_TYPES.has(answer.type)) {
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
        className="image-view-button"
        onClick={() => onImageClick(imageUrl)}
      >
        答え画像を見る
      </button>
    </div>
  );
}
