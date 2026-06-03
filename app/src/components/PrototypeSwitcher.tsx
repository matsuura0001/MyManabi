import { useMemo } from "react";
import { VARIANTS, type Variant } from "../lib/variant";

export function PrototypeSwitcher({
  cycleVariant,
  selectVariant,
  variant,
}: {
  cycleVariant: (direction: number) => void;
  selectVariant: (variant: Variant) => void;
  variant: Variant;
}) {
  const current = useMemo(() => VARIANTS.find((item) => item.id === variant)!, [variant]);
  return (
    <aside className="prototype-switcher">
      <button type="button" onClick={() => cycleVariant(-1)} aria-label="前の案">
        ←
      </button>
      <select
        value={variant}
        onChange={(event) => selectVariant(event.currentTarget.value as Variant)}
      >
        {VARIANTS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.id} — {item.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => cycleVariant(1)} aria-label="次の案">
        →
      </button>
      <span>PROTOTYPE</span>
      <em>{current.name}</em>
    </aside>
  );
}
