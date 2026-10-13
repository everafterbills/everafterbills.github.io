import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import PinPad from "../components/PinPad.jsx";
import { authApi, saveDevice, clearDevice } from "../lib/api.js";
import { deviceLabel } from "../lib/platform.js";
import { setItem } from "../lib/storage.js";

const fade = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.22 } };

export function pinError(r) {
  switch (r?.error) {
    case "bad_pin": return { message: `Wrong PIN. ${r.tries_left} ${r.tries_left === 1 ? "try" : "tries"} left before a short lock.` };
    case "locked": return { message: "Too many wrong PINs.", lockedUntil: r.locked_until };
    case "offline": return { message: "You're offline. Check your connection and try again." };
    default: return { message: "Something went wrong. Try again." };
  }
}

export default function SignIn({ onClose, onSignedIn }) {
  const [stage, setStage] = useState("checking");
  const [note, setNote] = useState("");

  const check = async () => {
    setStage("checking");
    const s = await authApi.status();
    if (s.error === "offline" || s.error === "server") { setStage("error"); return; }
    if (!s.setup_done) setStage("setup");
    else if (!s.trusted) { clearDevice(); setStage("enroll"); }
    else setStage("pin");
  };
  useEffect(() => { check(); }, []);

  const login = async (pin) => {
    const r = await authApi.login(pin);
    if (r.ok) { setItem("ea.lastSeen", Date.now()); onSignedIn(r); return { ok: true }; }
    if (r.error === "untrusted" || r.error === "revoked") {
      clearDevice();
      setNote(r.error === "revoked" ? "This device was removed after too many wrong PINs. Enter your household key to set it up again." : "");
      setStage("enroll");
      return { ok: true };
    }
    return { ok: false, ...pinError(r) };
  };

  const titles = { checking: "", setup: "Set up Ever After", enroll: "Set up this device", pin: "", error: "Can't connect" };

  return (
    <Sheet title={titles[stage]} onClose={onClose} label="Sign in">
      <AnimatePresence mode="wait">
        {stage === "checking" && (
          <motion.div key="c" {...fade} className="loading"><div className="spin" /></motion.div>
        )}
        {stage === "error" && (
          <motion.div key="e" {...fade}>
            <p className="field-note" style={{ fontSize: 16, color: "var(--text-2)" }}>Ever After couldn't reach its server. Check your connection, then try again.</p>
            <button className="btn btn-glass btn-wide" onClick={check}>Try again</button>
          </motion.div>
        )}
        {stage === "pin" && (
          <motion.div key="p" {...fade}>
            <PinPad title="Enter your PIN" subtitle={note || "Your PIN opens your profile."} onSubmit={login} />
          </motion.div>
        )}
        {stage === "enroll" && (
          <motion.div key="en" {...fade}>
            <Enroll note={note} onDone={() => { setNote("This device is set up."); setStage("pin"); }} />
          </motion.div>
        )}
        {stage === "setup" && (
          <motion.div key="s" {...fade}>
            <Setup onDone={() => { setNote("You're all set. Sign in with your PIN."); setStage("pin"); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function SecretInput({ value, onChange, placeholder, autoFocus, id }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input id={id} className="text-input" type={show ? "text" : "password"} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck="false"
        data-autofocus={autoFocus ? "" : undefined} style={{ paddingRight: 52 }} />
      <button type="button" className="mini-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide" : "Show"}
        style={{ position: "absolute", right: 10, top: 10 }}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function Enroll({ note, onDone }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState(deviceLabel());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return setErr("Enter your household key.");
    setBusy(true); setErr("");
    const r = await authApi.enroll(key, label);
    setBusy(false);
    if (r.ok) { saveDevice(r); onDone(); return; }
    if (r.error === "bad_key") setErr(`That household key isn't right. ${r.tries_left} ${r.tries_left === 1 ? "try" : "tries"} left this hour.`);
    else if (r.error === "locked") setErr("Too many wrong keys. Device setup is paused for up to an hour.");
    else if (r.error === "offline") setErr("You're offline. Check your connection and try again.");
    else setErr("Something went wrong. Try again.");
  };
  return (
    <form onSubmit={submit}>
      <div className="callout" style={{ marginTop: 0 }}>
        <ShieldCheck size={20} style={{ flex: "none", marginTop: 1 }} />
        <span>{note || "Each new phone or computer needs your household key once. After that, you'll only need your PIN."}</span>
      </div>
      <div className="stack">
        <label className="sr-only" htmlFor="hk">Household key</label>
        <SecretInput id="hk" value={key} onChange={setKey} placeholder="Household key" autoFocus />
        <label className="sr-only" htmlFor="dl">Device name</label>
        <input id="dl" className="text-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Device name" maxLength={40} />
      </div>
      {err && <p className="field-error">{err}</p>}
      <button className="btn btn-primary btn-wide" style={{ marginTop: 18 }} disabled={busy}>
        {busy ? "Checking…" : "Trust this device"}
      </button>
    </form>
  );
}

function Setup({ onDone }) {
  const [step, setStep] = useState("intro");
  const [key, setKey] = useState("");
  const [key2, setKey2] = useState("");
  const [pins, setPins] = useState({ nick: "", courtney: "" });
  const [first, setFirst] = useState("");
  const [label, setLabel] = useState(deviceLabel());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState("");

  const keyNext = (e) => {
    e.preventDefault();
    if (key.trim().length < 10) return setErr("Use at least 10 characters.");
    if (key !== key2) return setErr("The two keys don't match.");
    setErr(""); setStep("nick");
  };

  const choosePin = (who, next) => async (pin) => {
    if (!first) {
      if (who === "courtney" && pin === pins.nick) return { ok: false, message: "Courtney's PIN has to be different from Nick's." };
      setRetry(""); setFirst(pin); return { ok: true };
    }
    if (pin !== first) { setFirst(""); setRetry("Those PINs didn't match. Choose one again."); return { ok: true }; }
    setPins((p) => ({ ...p, [who]: pin })); setFirst(""); setRetry(""); setStep(next);
    return { ok: true };
  };

  const finish = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await authApi.setup({ householdKey: key, nickPin: pins.nick, courtneyPin: pins.courtney, label });
    setBusy(false);
    if (r.ok) { saveDevice(r); onDone(); return; }
    setErr({
      already_setup: "Ever After is already set up. Close this and sign in.",
      same_pin: "Nick and Courtney need different PINs.",
      weak_key: "The household key needs at least 10 characters.",
      offline: "You're offline. Check your connection and try again.",
    }[r.error] || "Setup didn't finish. Try again.");
  };

  if (step === "intro") return (
    <div>
      <p style={{ color: "var(--text-2)", marginTop: 0 }}>Welcome. This one-time setup creates your household key and both of your PINs.</p>
      <div className="group">
        <div className="row"><KeyRound size={20} color="var(--accent)" /><span style={{ flex: 1 }}>A household key trusts each new phone or computer, once.</span></div>
        <div className="row"><ShieldCheck size={20} color="var(--accent)" /><span style={{ flex: 1 }}>Your 6-digit PIN opens your own profile every day.</span></div>
      </div>
      <button className="btn btn-primary btn-wide" style={{ marginTop: 18 }} onClick={() => setStep("key")} data-autofocus>Get started</button>
    </div>
  );

  if (step === "key") return (
    <form onSubmit={keyNext}>
      <h3 style={{ margin: "0 0 6px", fontSize: 20 }}>Create a household key</h3>
      <p className="field-note" style={{ margin: "0 0 14px", fontSize: 15 }}>
        Use a phrase you'll remember, at least 10 characters. Write it down somewhere safe outside this app; you'll need it for each new device.
      </p>
      <div className="stack" style={{ marginTop: 0 }}>
        <SecretInput value={key} onChange={setKey} placeholder="Household key" autoFocus />
        <SecretInput value={key2} onChange={setKey2} placeholder="Type it again" />
      </div>
      {err && <p className="field-error">{err}</p>}
      <button className="btn btn-primary btn-wide" style={{ marginTop: 18 }}>Continue</button>
    </form>
  );

  if (step === "nick" || step === "courtney") {
    const name = step === "nick" ? "Nick" : "Courtney";
    return (
      <PinPad key={step + (first ? "2" : "1")}
        title={first ? `Confirm ${name}'s PIN` : `${name}, choose your PIN`}
        subtitle={first ? "Enter the same 6 digits again." : retry ? retry : step === "courtney" ? "Hand the phone to Courtney, or enter her PIN together." : "This PIN opens your profile."}
        onSubmit={choosePin(step, step === "nick" ? "courtney" : "device")} />
    );
  }

  return (
    <form onSubmit={finish}>
      <h3 style={{ margin: "0 0 6px", fontSize: 20 }}>Name this device</h3>
      <p className="field-note" style={{ margin: "0 0 14px", fontSize: 15 }}>You'll see it under Trusted devices in Settings, where you can remove it later.</p>
      <input className="text-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} data-autofocus />
      {err && <p className="field-error">{err}</p>}
      <button className="btn btn-primary btn-wide" style={{ marginTop: 18 }} disabled={busy}>{busy ? "Setting up…" : "Finish setup"}</button>
    </form>
  );
}
