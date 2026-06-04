import { S, F } from '../theme.js';

/**
 * SVG ring progress indicator.
 * pct  — 0-100 completion percentage
 * size — outer diameter in px (default 52)
 */
export function CircularProgress({ pct = 0, size = 52 }) {
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 100 ? S.green : S.green;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={S.faint} strokeWidth={stroke} />
        {/* Progress arc */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 100 ? S.green : S.white, fontFamily: F }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}
