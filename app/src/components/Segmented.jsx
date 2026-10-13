import { motion } from "framer-motion";

export default function Segmented({ options, value, onChange, id, className = "", sound }) {
  return (
    <div className={"segmented glass " + className} role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} data-sound={sound} onClick={() => onChange(o.value)}>
          {value === o.value && (
            <motion.span layoutId={"seg-" + id} className="pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span style={{ position: "relative" }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
