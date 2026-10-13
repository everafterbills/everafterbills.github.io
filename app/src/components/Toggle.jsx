import { motion } from "framer-motion";
import { play } from "../lib/feedback.js";

export default function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle"
      disabled={disabled} data-sound="none" onClick={() => { play(checked ? "toggleOff" : "toggleOn"); onChange(!checked); }} style={disabled ? { opacity: 0.5 } : undefined}>
      <motion.span className="knob" animate={{ x: checked ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
    </button>
  );
}
