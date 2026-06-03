export type View = "learner" | "parent";
export type Variant = "A" | "B";
export type FeedbackStyle = "inline" | "banner" | "sheet";

export function readVariant(): Variant {
  const value = new URLSearchParams(window.location.search).get("variant");
  return value === "B" ? "B" : "A";
}
