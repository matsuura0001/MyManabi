export type View = "learner" | "parent";
export type Variant = "A" | "B";
export type FeedbackStyle = "inline" | "banner" | "sheet";

export const VARIANTS: { id: Variant; name: string }[] = [
  { id: "A", name: "問題ファースト" },
  { id: "B", name: "親子ホーム" },
];

export function readVariant(): Variant {
  const value = new URLSearchParams(window.location.search).get("variant");
  return value === "B" ? "B" : "A";
}

export function setVariantInUrl(variant: Variant) {
  const params = new URLSearchParams(window.location.search);
  params.set("variant", variant);
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
}
