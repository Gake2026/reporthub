const PALETTE: Array<[string, string]> = [
  ["#1d4ed8", "#ffffff"],
  ["#0e7490", "#ffffff"],
  ["#6d28d9", "#ffffff"],
  ["#b45309", "#ffffff"],
  ["#be123c", "#ffffff"],
  ["#0f766e", "#ffffff"],
  ["#4d7c0f", "#ffffff"],
  ["#a21caf", "#ffffff"],
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function Avatar({
  name,
  avatar,
  size = 40,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
  const [bg, fg] = colorFor(name || "?");
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(12, Math.round(size * 0.38)),
        fontWeight: 700,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials(name)}
    </div>
  );
}
