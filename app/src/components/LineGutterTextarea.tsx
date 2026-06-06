import "./LineGutterTextarea.css";

export type LineGutterTextareaProps = {
  labels: string[];
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  autoFocus?: boolean;
};

export function LineGutterTextarea({
  labels,
  value,
  onChange,
  minRows = 3,
  autoFocus = false,
}: LineGutterTextareaProps) {
  const lineCount = Math.max(
    labels.length,
    value.split(/\r?\n/).length,
    minRows
  );

  return (
    <div className="line-gutter-textarea-scroll">
      <div className="line-gutter-textarea-content">
        <div className="line-gutter" aria-hidden="true">
          {labels.map((label, index) => (
            <div key={index} className="line-gutter-item" title={label}>
              {label}
            </div>
          ))}
        </div>
        <textarea
          className="line-gutter-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={lineCount}
          autoFocus={autoFocus}
          wrap="off"
          spellCheck={false}
          aria-label="小問の回答"
        />
      </div>
    </div>
  );
}
