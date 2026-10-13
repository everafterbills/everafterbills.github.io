import { motion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber.jsx";

// A gold ring that closes as the month's bills get paid. Sized by CSS so it scales with the screen.
export default function PromiseRing({ fraction = 0 }) {
  const size = 100, stroke = 8.5, r = (size - stroke) / 2 - 2, c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  const done = f >= 0.999;
  const pct = Math.round(f * 100);
  return (
    <div className="ring" role="img" aria-label={`${pct} percent paid`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF0C9" /><stop offset="0.55" stopColor="var(--accent)" /><stop offset="1" stopColor="#C99A4E" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-gold)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={false} animate={{ strokeDashoffset: c * (1 - f), opacity: f > 0 ? 1 : 0 }}
          transition={{ strokeDashoffset: { type: "spring", stiffness: 70, damping: 20 }, opacity: { duration: 0.2 } }}
          style={{ filter: "drop-shadow(0 0 5px rgba(235,203,139,.45))" }} />
        <motion.path initial={false} animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={{ type: "spring", stiffness: 380, damping: 22 }}
          style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
          d="M50 37 C51.6 46.6 53.4 48.4 63 50 C53.4 51.6 51.6 53.4 50 63 C48.4 53.4 46.6 51.6 37 50 C46.6 48.4 48.4 46.6 50 37Z" fill="var(--accent)" />
      </svg>
      <motion.span className="ring-pct" initial={false} animate={{ opacity: done ? 0 : 1 }}>
        <AnimatedNumber value={pct} format="percent" />
      </motion.span>
    </div>
  );
}
