import { useEffect, useRef } from "react";
import { motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";

// Bottom sheet on phones, centered dialog on wide screens. Swipe down or tap outside to close.
export default function Sheet({ title, onClose, children, actions, dismissible = true, label }) {
  const controls = useDragControls();
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && dismissible) onClose?.(); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => ref.current?.querySelector("[data-autofocus]")?.focus(), 250);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [onClose, dismissible]);

  return (
    <motion.div className="sheet-wrap" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }} onClick={() => dismissible && onClose?.()} />
      <motion.div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        drag={dismissible ? "y" : false}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 700) onClose?.(); }}
      >
        <div className="grab" onPointerDown={(e) => dismissible && controls.start(e)}><span /></div>
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
        <div className="body">{children}</div>
      </motion.div>
    </motion.div>
  );
}
