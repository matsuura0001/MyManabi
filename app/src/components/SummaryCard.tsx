export function SummaryCard({
  accent = false,
  label,
  unit,
  value,
}: {
  accent?: boolean;
  label: string;
  unit: string;
  value: string;
}) {
  return (
    <article className={`summary-card ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </article>
  );
}
