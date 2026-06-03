import { useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { ExtractionCandidate, ExtractionResult, RegionRatio } from "../../domain/extraction";

export function RegionEditModal({
  candidate,
  extractionPath,
  sourceDocumentId,
  onClose,
  onUpdated,
}: {
  candidate: ExtractionCandidate;
  extractionPath: string | null;
  sourceDocumentId: string;
  onClose: () => void;
  onUpdated: (result: ExtractionResult) => void;
}) {
  const [crop, setCrop] = useState<Crop>(() => ({
    unit: "%",
    x: candidate.region.x * 100,
    y: candidate.region.y * 100,
    width: candidate.region.width * 100,
    height: candidate.region.height * 100,
  }));
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  // Derive the page image path from the extraction-result.json path
  const extractionDir = extractionPath?.replace(/[/\\]extraction-result\.json$/i, "") ?? null;
  const pageNum = String(candidate.page).padStart(3, "0");
  const sep = extractionDir?.includes("\\") ? "\\" : "/";
  const pageImagePath = extractionDir ? `${extractionDir}${sep}page-${pageNum}.png` : null;
  const pageImageUrl = pageImagePath ? convertFileSrc(pageImagePath) : null;

  async function handleConfirm() {
    setIsProcessing(true);
    setError(null);
    try {
      const region: RegionRatio = {
        x: crop.x / 100,
        y: crop.y / 100,
        width: crop.width / 100,
        height: crop.height / 100,
      };
      const result = await invoke<ExtractionResult>("reextract_candidate_region", {
        sourceDocumentId,
        candidateId: candidate.candidateId,
        region,
      });
      onUpdated(result);
      onClose();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsProcessing(false);
    }
  }

  function handleOverlayClick(event: React.MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  const canConfirm = !isProcessing && crop.width > 0 && crop.height > 0 && !imageLoadFailed;

  return (
    <div className="region-modal-overlay" onClick={handleOverlayClick}>
      <div className="region-modal">
        <div className="region-modal-header">
          <h2>領域を再指定 — ページ {candidate.page}</h2>
          <button type="button" className="region-modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="region-modal-body">
          {imageLoadFailed && (
            <div className="region-image-error">
              <p>ページ画像を読み込めませんでした。</p>
              <p>
                まず「OCR実行」で抽出を行い、ページ画像を生成してください。
              </p>
              <code>{pageImagePath ?? "パス不明"}</code>
            </div>
          )}

          {pageImageUrl && !imageLoadFailed && (
            <ReactCrop
              crop={crop}
              onChange={(_px, percentCrop) => setCrop(percentCrop)}
            >
              <img
                src={pageImageUrl}
                alt={`ページ ${candidate.page}`}
                style={{ maxWidth: "100%", maxHeight: "65vh", display: "block" }}
                onError={() => setImageLoadFailed(true)}
              />
            </ReactCrop>
          )}

          {!pageImageUrl && !imageLoadFailed && (
            <p className="region-loading">画像のパスを取得できませんでした。extractionPath を確認してください。</p>
          )}
        </div>

        {error && <p className="region-error">{error}</p>}

        <div className="region-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="small-button"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {isProcessing ? "処理中..." : "この領域で再OCR"}
          </button>
        </div>
      </div>
    </div>
  );
}
