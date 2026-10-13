import { motion } from "framer-motion";

// A gold ring that closes as the month's bills get paid.
export default function PromiseRing({ fraction = 0, size = 92 }) {
  const stroke = 8, r = (size - stroke) / 2 - 2, c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  const done = f >= 0.999;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={`${Math.round(f * 100)} percent paid`}>
      <defs>
        <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF0C9" /><stop offset="0.55" stopColor="var(--accent)" /><stop offset="1" stopColor="#C99A4E" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-gold)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={false} animate={{ strokeDashoffset: c * (1 - f) }} transition={{ type: "spring", stiffness: 60, damping: 18 }}
        style={{ filter: "drop-shadow(0 0 6px rgba(235,203,139,.45))" }} />
      {done ? (
        <path d={`M${size / 2} ${size / 2 - 11} C${size / 2 + 1.5} ${size / 2 - 2} ${size / 2 + 3} ${size / 2 - 1} ${size / 2 + 11} ${size / 2} C${size / 2 + 3} ${size / 2 + 1} ${size / 2 + 1.5} ${size / 2 + 2} ${size / 2} ${size / 2 + 11} C${size / 2 - 1.5} ${size / 2 + 2} ${size / 2 - 3} ${size / 2 + 1} ${size / 2 - 11} ${size / 2} C${size / 2 - 3} ${size / 2 - 1} ${size / 2 - 1.5} ${size / 2 - 2} ${size / 2} ${size / 2 - 11}Z`} fill="var(--accent)" />
      ) : (
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--text)"
          style={{ fontFamily: "var(--font-num)", fontSize: 18, fontWeight: 700 }}>{Math.round(f * 100)}%</text>
      )}
    </svg>
  );
}
