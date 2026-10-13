import { AnimatePresence, motion } from "framer-motion";

export default function Toast({ toast }) {
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="toast glass" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={toast.tone === "error" ? { color: "var(--coral)" } : undefined}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
