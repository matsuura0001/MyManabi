import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Question } from "../../domain/question";

type ProblemImageViewerProps = {
  presentation: Question["presentation"] | undefined;
  questionId: string;
  onImageClick: (imagePath: string) => void;
};

export function ProblemImageViewer({
  presentation,
  questionId,
  onImageClick,
}: ProblemImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImageUrl(null);
    setError(null);
    setLoading(false);

    if (!presentation) return;

    if (presentation.type === "image" && presentation.imagePath) {
      setImageUrl(convertFileSrc(presentation.imagePath));
      return;
    }

    if (
      (presentation.type === "source-page" || presentation.type === "source-region") &&
      presentation.documentId &&
      presentation.page !== undefined
    ) {
      setLoading(true);
      invoke<string>("get_page_image_path", {
        sourceDocumentId: presentation.documentId,
        page: presentation.page,
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
  }, [presentation]);

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
