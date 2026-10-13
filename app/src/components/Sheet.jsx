import { useEffect, useRef } from "react";
import { animate, motion, useDragControls, useIsPresent, useMotionValue } from "framer-motion";
import { X } from "lucide-react";
import { sheetOpened, sheetClosed } from "../lib/calm.js";

const SETTLE = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 };

// Bottom sheet on phones, centered dialog on wide screens. Swipe down or tap outside to close.
export default function Sheet({ title, onClose, children, actions, dismissible = true, label }) {
  const controls = useDragControls();
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const isPresent = useIsPresent();
  const y = useMotionValue("100%");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => { sheetOpened(); return sheetClosed; }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && dismissible) onClose?.(); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => ref.current?.querySelector("[data-autofocus]")?.focus(), 250);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [onClose, dismissible]);

  // Touch: pull the sheet down from anywhere — the handle and header always, the content once it's
  // scrolled to the top. The sheet follows the finger 1:1 and the page underneath never moves.
  useEffect(() => {
    const el = ref.current;
    if (!el || !dismissible) return;
    let g = null;
    const start = (e) => {
      g = null;
      if (e.touches.length !== 1 || !isPresent) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target || target.closest("input, textarea, select, [contenteditable]")) return;
      const p = e.touches[0];
      g = { x0: p.clientX, y0: p.clientY, inBody: !!bodyRef.current?.contains(target), active: false, decided: false, lastY: p.clientY, lastT: e.timeStamp, v: 0 };
    };
    const move = (e) => {
      if (!g) return;
      const p = e.touches[0];
      if (!p) return;
      const dy = p.clientY - g.y0, dx = p.clientX - g.x0;
      if (!g.decided) {
        if (Math.abs(dy) < 2 && Math.abs(dx) < 2) return;
        g.decided = true;
        const atTop = !g.inBody || (bodyRef.current?.scrollTop ?? 0) <= 0;
        if (!(atTop && dy > 0 && dy >= Math.abs(dx))) { g = null; return; } // let the content scroll
        g.active = true;
        g.y0 = p.clientY;
        y.stop();
      }
      if (e.cancelable) e.preventDefault();
      const off = Math.max(0, p.clientY - g.y0);
      y.set(off);
      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.v = g.v * 0.4 + ((p.clientY - g.lastY) / dt) * 1000 * 0.6;
      g.lastY = p.clientY; g.lastT = e.timeStamp;
    };
    const end = () => {
      if (!g || !g.active) { g = null; return; }
      const off = Number(y.get()) || 0;
      const fling = g.v > 550 && off > 24;
      g = null;
      if (off > 110 || fling) closeRef.current?.();
      else animate(y, 0, SETTLE);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [dismissible, isPresent, y]);

  // Mouse: drag the handle or header.
  const mouseDrag = (e) => {
    if (!dismissible || e.pointerType !== "mouse" || e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("button, a, input")) return;
    controls.start(e);
  };

  return (
    <motion.div className="sheet-wrap" initial={{ opacity: 1 }} exit={{ opacity: 1 }}
      style={{ pointerEvents: isPresent ? "auto" : "none" }} {...(!isPresent ? { inert: "" } : {})}>
      <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }} onClick={() => dismissible && onClose?.()} />
      <motion.div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        style={{ y }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { type: "spring", stiffness: 380, damping: 40, mass: 0.8 } }}
        transition={{ type: "spring", stiffness: 360, damping: 38, mass: 0.9 }}
        drag={dismissible ? "y" : false}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 700) onClose?.(); }}
      >
        <div className="sheet-top" onPointerDown={mouseDrag}>
          <div className="grab"><span /></div>
          {(title || dismissible) && (
            <div className="sheet-head">
              <h2>{title}</h2>
              {actions}
              {dismissible && (
                <button className="icon-btn btn-glass" style={{ width: 34, height: 34 }} onClick={onClose} aria-label="Close">
                  <X size={18} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="body" ref={bodyRef}>{children}</div>
      </motion.div>
    </motion.div>
  );
}
