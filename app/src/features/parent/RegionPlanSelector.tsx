import { useMemo, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { ExtractionResult, RegionRatio } from "../../domain/extraction";

type RegionPlanSource = "default-full-page" | "inherited" | "manual";
type RegionPlanStatus = "pending" | "ocr-done" | "needs-adjustment" | "skipped";

type RegionPlan = {
  page: number;
  region: RegionRatio;
  source: RegionPlanSource;
  status: RegionPlanStatus;
};

const fullPageRegion: RegionRatio = { x: 0, y: 0, width: 1, height: 1 };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toCrop(region: RegionRatio): Crop {
  return {
    unit: "%",
    x: clamp(region.x * 100, 0, 100),
    y: clamp(region.y * 100, 0, 100),
    width: clamp(region.width * 100, 0, 100),
    height: clamp(region.height * 100, 0, 100),
  };
}

function toRegion(crop: Crop | undefined): RegionRatio | null {
  if (!crop) return null;
  const x = clamp(crop.x / 100, 0, 1);
  const y = clamp(crop.y / 100, 0, 1);
  const width = clamp(crop.width / 100, 0, 1 - x);
  const height = clamp(crop.height / 100, 0, 1 - y);
  if (width <= 0 || height <= 0) return null;
  return {
    x,
    y,
    width,
    height,
  };
}

function ignorePasteOrDrop(event: React.ClipboardEvent | React.DragEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function pageImagePath(extractionPath: string | null, imagePath: string): string | null {
  const extractionDir = extractionPath?.replace(/[/\\]extraction-result\.json$/i, "") ?? null;
  if (!extractionDir) return null;
  const sep = extractionDir.includes("\\") ? "\\" : "/";
  const parts = imagePath.split("/");
  const filename = parts[parts.length - 1] ?? imagePath;
  return `${extractionDir}${sep}${filename}`;
}

export function RegionPlanSelector({
  extractionPath,
  result,
  setImportError,
  sourceDocumentId,
  onUpdated,
}: {
  extractionPath: string | null;
  result: ExtractionResult;
  setImportError: (value: string | null) => void;
  sourceDocumentId: string;
  onUpdated: (result: ExtractionResult) => void;
}) {
  const [currentPage, setCurrentPage] = useState(result.pages[0]?.page ?? 1);
  const [processing, setProcessing] = useState(false);
  const [plans, setPlans] = useState<Record<number, RegionPlan>>(() =>
    Object.fromEntries(
      result.pages.map((page) => [
        page.page,
        {
          page: page.page,
          region: fullPageRegion,
          source: "default-full-page" as const,
          status: "pending" as const,
        },
      ]),
    ),
  );

  const page = result.pages.find((item) => item.page === currentPage) ?? result.pages[0];
  const plan = plans[currentPage];
  const crop = toCrop(plan?.region ?? fullPageRegion);
  const imagePath = page ? pageImagePath(extractionPath, page.imagePath) : null;
  const imageUrl = imagePath ? convertFileSrc(imagePath) : null;

  const counts = useMemo(
    () =>
      Object.values(plans).reduce(
        (acc, item) => {
          acc[item.status]++;
          return acc;
        },
        { pending: 0, "ocr-done": 0, "needs-adjustment": 0, skipped: 0 },
      ),
    [plans],
  );

  function updatePagePlan(pageNumber: number, patch: Partial<RegionPlan>) {
    setPlans((current) => ({
      ...current,
      [pageNumber]: { ...current[pageNumber], ...patch },
    }));
  }

  function applyToFollowing(region: RegionRatio) {
    setPlans((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, item]) => {
          if (item.page < currentPage || item.source === "manual") return [key, item];
          return [
            key,
            {
              ...item,
              region,
              source: item.page === currentPage ? "manual" : "inherited",
              status: item.status === "ocr-done" ? "needs-adjustment" : item.status,
            },
          ];
        }),
      ),
    );
  }

  async function ocrPlan(pageNumber: number, region: RegionRatio) {
    const updated = await invoke<ExtractionResult>("ocr_source_region", {
      sourceDocumentId,
      page: pageNumber,
      region,
    });
    onUpdated(updated);
    updatePagePlan(pageNumber, { status: "ocr-done" });
  }

  async function ocrCurrent() {
    const current = plans[currentPage];
    if (!current || current.status === "skipped") return;
    setProcessing(true);
    setImportError(null);
    try {
      await ocrPlan(current.page, current.region);
    } catch (caught) {
      setImportError(String(caught));
      updatePagePlan(current.page, { status: "needs-adjustment" });
    } finally {
      setProcessing(false);
    }
  }

  async function ocrPending() {
    setProcessing(true);
    setImportError(null);
    try {
      for (const item of Object.values(plans).sort((a, b) => a.page - b.page)) {
        if (item.status !== "pending") continue;
        await ocrPlan(item.page, item.region);
      }
    } catch (caught) {
      setImportError(String(caught));
    } finally {
      setProcessing(false);
    }
  }

  if (!page || !plan) return null;

  return (
    <section className="region-plan">
      <div className="region-plan-header">
        <div>
          <p className="eyebrow">ページ画像から領域を指定</p>
          <h2>先に矩形を決めてから OCR</h2>
        </div>
        <p className="review-counts">
          未処理: {counts.pending} / OCR済み: {counts["ocr-done"]} / 要確認: {counts["needs-adjustment"]} / スキップ: {counts.skipped}
        </p>
      </div>

      <div className="region-plan-tabs">
        {result.pages.map((item) => (
          <button
            className={item.page === currentPage ? "active" : ""}
            key={item.page}
            type="button"
            onClick={() => setCurrentPage(item.page)}
          >
            {item.page}
          </button>
        ))}
      </div>

      <div
        className="region-plan-stage"
        onDrop={ignorePasteOrDrop}
        onDragOver={(event) => event.preventDefault()}
        onPaste={ignorePasteOrDrop}
      >
        {imageUrl ? (
          <ReactCrop
            crop={crop}
            onChange={(_px, percentCrop) => {
              const region = toRegion(percentCrop);
              if (!region) return;
              updatePagePlan(currentPage, {
                region,
                source: "manual",
                status: plan.status === "ocr-done" ? "needs-adjustment" : plan.status,
              });
            }}
          >
            <img
              alt={`ページ ${currentPage}`}
              src={imageUrl}
            />
          </ReactCrop>
        ) : (
          <p className="region-loading">ページ画像のパスを取得できませんでした。</p>
        )}
      </div>

      <div className="region-plan-actions">
        <button
          className="secondary-button"
          disabled={processing}
          type="button"
          onClick={() => updatePagePlan(currentPage, { region: fullPageRegion, source: "manual", status: "pending" })}
        >
          全体
        </button>
        <button
          className="secondary-button"
          disabled={processing || currentPage <= 1 || !plans[currentPage - 1]}
          type="button"
          onClick={() => {
            const previous = plans[currentPage - 1];
            if (previous) {
              updatePagePlan(currentPage, {
                region: previous.region,
                source: "inherited",
                status: plan.status === "ocr-done" ? "needs-adjustment" : "pending",
              });
            }
          }}
        >
          前ページを引き継ぐ
        </button>
        <button
          className="secondary-button"
          disabled={processing}
          type="button"
          onClick={() => applyToFollowing(plan.region)}
        >
          以降へ適用
        </button>
        <button
          className="text-button"
          disabled={processing}
          type="button"
          onClick={() => updatePagePlan(currentPage, { status: "skipped" })}
        >
          スキップ
        </button>
        <button
          className="small-button"
          disabled={processing || plan.status === "skipped"}
          type="button"
          onClick={ocrCurrent}
        >
          {processing ? "処理中..." : "このページを OCR"}
        </button>
        <button
          className="small-button"
          disabled={processing || counts.pending === 0}
          type="button"
          onClick={ocrPending}
        >
          未処理をまとめて OCR
        </button>
      </div>
    </section>
  );
}
