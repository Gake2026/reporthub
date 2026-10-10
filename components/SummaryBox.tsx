/** Presentational card rendering a deterministic, data-driven performance summary. */
export default function SummaryBox({
  paragraphs,
}: {
  paragraphs: string[];
}) {
  if (paragraphs.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3>Performance summary</h3>
      {paragraphs.map((p, i) => (
        <p key={i} style={i === paragraphs.length - 1 ? { marginBottom: 0 } : undefined}>
          {p}
        </p>
      ))}
    </div>
  );
}
