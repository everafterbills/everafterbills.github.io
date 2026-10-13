import { motion } from "framer-motion";

export default function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle"
      disabled={disabled} onClick={() => onChange(!checked)} style={disabled ? { opacity: 0.5 } : undefined}>
      <motion.span className="knob" animate={{ x: checked ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
    </button>
  );
}
