import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import { CHANGELOG } from "../changelog.js";

export default function Changelog({ onClose }) {
  const [open, setOpen] = useState(() => new Set([CHANGELOG[0]?.version]));
  const toggle = (v) => setOpen((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  return (
    <Sheet title="What's new" onClose={onClose}>
      {CHANGELOG.map((r) => {
        const isOpen = open.has(r.version);
        return (
          <section className="release" key={r.version}>
            <button className="release-head" onClick={() => toggle(r.version)} aria-expanded={isOpen}>
              <span className="v">v{r.version}</span>
              <span className="t">{r.title}<br /><span className="d">{r.date}</span></span>
              <motion.span animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown size={20} color="var(--text-3)" /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
                  <ul>{r.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </Sheet>
  );
}
