import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

type ImageSource =
  | { kind: "file"; path: string }
  | { kind: "page"; documentId: string; page: number }
  | null;

/** Resolved URL state for a local file or a page-image fetched from Rust. */
export function useImageUrl(source: ImageSource): {
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
} {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable cache key so the effect only re-runs when the source actually changes.
  const key =
    source === null
      ? null
      : source.kind === "file"
        ? `file:${source.path}`
        : `page:${source.documentId}:${source.page}`;

  useEffect(() => {
    setImageUrl(null);
    setError(null);
    setLoading(false);

    if (!source) return;

    if (source.kind === "file") {
      setImageUrl(convertFileSrc(source.path));
      return;
    }

    setLoading(true);
    invoke<string>("get_page_image_path", {
      sourceDocumentId: source.documentId,
      page: source.page,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { imageUrl, loading, error };
}
