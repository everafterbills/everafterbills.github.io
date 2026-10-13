import { motion, useIsPresent } from "framer-motion";
import PinPad from "../components/PinPad.jsx";
import { authApi } from "../lib/api.js";
import { setItem } from "../lib/storage.js";
import { pinError } from "./SignIn.jsx";
import { play } from "../lib/feedback.js";

export default function LockScreen({ name, onUnlocked, onSignOut, onUntrusted }) {
  const isPresent = useIsPresent();
  const submit = async (pin) => {
    const r = await authApi.login(pin);
    if (r.ok) { setItem("ea.lastSeen", Date.now()); play("success"); onUnlocked(); return { ok: true }; }
    if (r.error === "untrusted" || r.error === "revoked") { onUntrusted(); return { ok: true }; }
    return { ok: false, ...pinError(r) };
  };
  return (
    <motion.div className="sheet-wrap" style={{ alignItems: "center", zIndex: 50, pointerEvents: isPresent ? "auto" : "none" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="sheet-scrim" style={{ background: "rgba(14,7,26,.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }} />
      <div style={{ position: "relative", padding: "0 20px" }}>
        <img src="/icons/mark.svg" alt="" style={{ width: 54, height: 54, display: "block", margin: "0 auto 4px" }} />
        <PinPad title={name ? `Welcome back, ${name}` : "Welcome back"} subtitle="Enter your PIN to unlock." onSubmit={submit}
          footer={<button className="quiet-btn" onClick={onSignOut}>Sign out</button>} />
      </div>
    </motion.div>
  );
}
