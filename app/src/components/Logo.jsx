import { motion } from "framer-motion";

export function Mark({ className = "mark", layoutId = "logo-mark" }) {
  return (
    <motion.img layoutId={layoutId} src="/icons/mark.svg" alt="" className={className} draggable="false"
      transition={{ type: "spring", stiffness: 210, damping: 28 }} />
  );
}

export function Wordmark({ as = "h1", layoutId = "logo-word" }) {
  const C = motion[as];
  return (
    <C layoutId={layoutId} className="wordmark" transition={{ type: "spring", stiffness: 210, damping: 28 }}>
      Ever After
    </C>
  );
}
