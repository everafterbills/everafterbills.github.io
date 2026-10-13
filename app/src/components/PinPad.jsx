import { useEffect, useState, useCallback } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Delete } from "lucide-react";
import { play } from "../lib/feedback.js";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

// 6-digit PIN entry. onSubmit(pin) resolves to { ok } or { ok:false, message, lockedUntil }.
export default function PinPad({ title, subtitle, onSubmit, footer, autoFocusKeys = true }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lockedUntil, setLockedUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const shake = useAnimationControls();
  const locked = lockedUntil && lockedUntil > now;

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const press = useCallback((k) => {
    if (busy || locked) return;
    setMsg("");
    if (k === "del") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < 6 ? p + k : p));
  }, [busy, locked]);

  useEffect(() => {
    if (!autoFocusKeys) return;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, autoFocusKeys]);

  useEffect(() => {
    if (pin.length !== 6) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const r = (await onSubmit(pin)) || {};
      if (cancelled) return;
      setBusy(false);
      if (!r.ok) {
        setMsg(r.message || "That didn't work. Try again.");
        if (r.lockedUntil) { setLockedUntil(new Date(r.lockedUntil).getTime()); setNow(Date.now()); }
        play("error");
        shake.start({ x: [0, -16, 14, -10, 6, 0], transition: { duration: 0.42 } });
        setPin("");
      }
    })();
    return () => { cancelled = true; };
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = locked ? Math.ceil((lockedUntil - now) / 1000) : 0;
  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="pin">
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <motion.div className="dots" animate={shake} aria-label={`${pin.length} of 6 digits entered`} role="status">
        {Array.from({ length: 6 }, (_, i) => (
          <motion.span key={i} className={i < pin.length ? "on" : ""}
            animate={busy ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
            transition={busy ? { duration: 0.9, repeat: Infinity, delay: i * 0.08 } : {}} />
        ))}
      </motion.div>
      <div className="msg">{locked ? `Too many wrong PINs. Try again in ${mmss}.` : msg}</div>
      <div className="keys">
        {KEYS.map((k, i) =>
          k === "" ? <span key={i} /> :
          k === "del" ? (
            <button key={i} type="button" className="key ghost" onClick={() => press("del")} aria-label="Delete" disabled={busy || locked}>
              <Delete size={26} style={{ margin: "auto" }} />
            </button>
          ) : (
            <button key={i} type="button" className="key" onClick={() => press(k)} disabled={busy || locked}>{k}</button>
          )
        )}
      </div>
      {footer}
    </div>
  );
}
