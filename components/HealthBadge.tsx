interface Driver {
  label: string;
  detail: string;
  impact: number;
}

interface HealthBadgeProps {
  score: number;
  flag: "healthy" | "watch" | "at-risk";
  drivers: Driver[];
}

/** Colored health pill; expanding it reveals the score drivers. */
export default function HealthBadge({
  score,
  flag,
  drivers,
}: HealthBadgeProps) {
  const palette =
    score >= 75
      ? { background: "#dcfce7", color: "#15803d" }
      : score >= 50
        ? { background: "#fef3c7", color: "#b45309" }
        : { background: "#fee2e2", color: "#b91c1c" };

  return (
    <details style={{ position: "relative", display: "inline-block" }}>
      <summary
        className="badge"
        style={{
          background: palette.background,
          color: palette.color,
          cursor: "pointer",
          userSelect: "none",
        }}
        title="Show score drivers"
      >
        {score} · {flag}
      </summary>
      <div
        className="card"
        style={{
          position: "absolute",
          zIndex: 30,
          minWidth: 280,
          maxWidth: 340,
          marginTop: 8,
          right: 0,
          textAlign: "left",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Health score: {score}</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {drivers.map((d, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <strong>{d.label}</strong>
                <span
                  className="num"
                  style={{
                    color: d.impact > 0 ? "#b91c1c" : "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  −{d.impact} pts
                </span>
              </div>
              <div className="sub">{d.detail}</div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
