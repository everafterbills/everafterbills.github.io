import { useLayoutEffect, useRef } from "react";
import { animate } from "framer-motion";
import { money } from "../lib/billing.js";

// Counts smoothly between values, always landing on the exact amount. Works in whole cents so it never drifts.
export default function AnimatedNumber({ value, format = "money", className = "", duration = 0.7 }) {
  const ref = useRef(null);
  const shown = useRef(null);
  const target = Math.round((Number(value) || 0) * (format === "money" ? 100 : 1));
  const render = (n) => (format === "money" ? money(n / 100) : format === "percent" ? `${n}%` : String(n));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (from === null || from === target || reduce) {
      shown.current = target;
      el.textContent = render(target);
      return;
    }
    const controls = animate(from, target, {
      duration, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { const n = Math.round(v); shown.current = n; el.textContent = render(n); },
      onComplete: () => { shown.current = target; el.textContent = render(target); },
    });
    return () => controls.stop();
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref} className={"num " + className} aria-label={render(target)} />;
}
