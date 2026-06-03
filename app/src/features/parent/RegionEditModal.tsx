import { useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { ExtractionCandidate, ExtractionResult, RegionRatio } from "../../domain/extraction";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toRegion(crop: Crop | undefined): RegionRatio | null {
  if (!crop) return null;
  const x = clamp(crop.x / 100, 0, 1);
  const y = clamp(crop.y / 100, 0, 1);
  const width = clamp(crop.width / 100, 0, 1 - x);
  const height = clamp(crop.height / 100, 0, 1 - y);
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function ignorePasteOrDrop(event: React.ClipboardEvent | React.DragEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function RegionEditModal({
  candidate,
  extractionPath,
  sourceDocumentId,
  pages,
  onClose,
  onUpdated,
}: {
  candidate: ExtractionCandidate;
  extractionPath: string | null;
  sourceDocumentId: string;
  pages: Array<{ page: number; imagePath: string }>;
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

  // Derive the page image path from the extraction dir + pages[] metadata.
  // Using pages[].imagePath (the filename part) avoids hard-coding the naming convention.
  const extractionDir = extractionPath?.replace(/[/\\]extraction-result\.json$/i, "") ?? null;
  const sep = extractionDir?.includes("\\") ? "\\" : "/";
  const pageRecord = pages.find((p) => p.page === candidate.page);
  const pageImagePath = (() => {
    if (!extractionDir || !pageRecord) return null;
    // imagePath is relative (e.g. "content/extractions/id/page-001.png"); use only the filename.
    const parts = pageRecord.imagePath.split("/");
    const filename = parts[parts.length - 1] ?? pageRecord.imagePath;
    return `${extractionDir}${sep}${filename}`;
  })();
  const pageImageUrl = pageImagePath ? convertFileSrc(pageImagePath) : null;

  async function handleConfirm() {
    setIsProcessing(true);
    setError(null);
    try {
      const region = toRegion(crop);
      if (!region) {
        setError("有効な領域を選択してください。");
        return;
      }
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

        <div
          className="region-modal-body"
          onDrop={ignorePasteOrDrop}
          onDragOver={(event) => event.preventDefault()}
          onPaste={ignorePasteOrDrop}
        >
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
              onChange={(_px, percentCrop) => {
                const region = toRegion(percentCrop);
                if (!region) return;
                setCrop({
                  unit: "%",
                  x: region.x * 100,
                  y: region.y * 100,
                  width: region.width * 100,
                  height: region.height * 100,
                });
              }}
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
