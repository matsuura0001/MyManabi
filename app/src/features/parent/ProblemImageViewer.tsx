import type { Question } from "../../domain/question";
import { useImageUrl } from "./useImageUrl";

type ProblemImageViewerProps = {
  presentation: Question["presentation"] | undefined;
  questionId: string;
  onImageClick: (imagePath: string) => void;
};

function toImageSource(
  presentation: Question["presentation"] | undefined
): Parameters<typeof useImageUrl>[0] {
  if (!presentation) return null;
  if (presentation.type === "image" && presentation.imagePath)
    return { kind: "file", path: presentation.imagePath };
  if (
    (presentation.type === "source-page" || presentation.type === "source-region") &&
    presentation.documentId &&
    presentation.page !== undefined
  )
    return { kind: "page", documentId: presentation.documentId, page: presentation.page };
  return null;
}

export function ProblemImageViewer({
  presentation,
  questionId,
  onImageClick,
}: ProblemImageViewerProps) {
  const { imageUrl, loading, error } = useImageUrl(toImageSource(presentation));

  // Don't render for text/audio or missing presentation
  if (!presentation || presentation.type === "text" || presentation.type === "audio") {
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
        alt={`問題画像 (${questionId})`}
        className="image-thumbnail"
        onClick={() => onImageClick(imageUrl)}
      />
      <button
        type="button"
        className="image-view-button"
        onClick={() => onImageClick(imageUrl)}
      >
        画像を見る
      </button>
    </div>
  );
}
