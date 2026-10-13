import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, BellRing, KeyRound, Smartphone, Info, Sparkles, Volume2 } from "lucide-react";
import Toggle from "../components/Toggle.jsx";
import Segmented from "../components/Segmented.jsx";
import Sheet from "../components/Sheet.jsx";
import PinPad from "../components/PinPad.jsx";
import { supabase } from "../lib/supabase.js";
import { authApi, getDevice, clearDevice, notifyApi } from "../lib/api.js";
import { enablePush, disablePushHere, currentSubscription, pushBlocker } from "../lib/push.js";
import { shortDate, isoToNyDate } from "../lib/dates.js";
import { VERSION } from "../config.js";
import { soundsEnabled, setSoundsEnabled, play } from "../lib/feedback.js";

export default function Settings({ hh, onBack, toast, onShowChangelog }) {
  const me = hh.me;
  const [hasSub, setHasSub] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [devices, setDevices] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [sounds, setSounds] = useState(soundsEnabled());
  const thisDevice = getDevice()?.id;
  const blocker = pushBlocker();

  const loadDevices = async () => {
    const { data, error } = await supabase.rpc("list_devices");
    setDevices(error ? [] : data);
  };
  useEffect(() => { currentSubscription().then((s) => setHasSub(!!s)).catch(() => setHasSub(false)); loadDevices(); }, []);

  const updateProfile = async (changes) => {
    hh.patchProfile(me.id, changes);
    const { error } = await supabase.from("profiles").update(changes).eq("id", me.id);
    if (error) { toast("Couldn't save that. Try again.", "error"); hh.reload(); }
  };

  const toggleReminders = async (on) => {
    setPushBusy(true);
    if (on) {
      const r = await enablePush().catch(() => ({ ok: false, message: "Couldn't turn on reminders. Try again." }));
      if (!r.ok) { setPushBusy(false); toast(r.message, "error"); return; }
      setHasSub(true);
      await updateProfile({ notify: true });
      toast("Reminders are on");
    } else {
      await disablePushHere().catch(() => {});
      setHasSub(false);
      await updateProfile({ notify: false });
      toast("Reminders are off");
    }
    setPushBusy(false);
  };

  const sendTest = async () => {
    const r = await notifyApi.test();
    if (r.ok && r.delivered > 0) toast("Test sent. It should arrive in a moment.");
    else if (r.ok) toast("No devices are set up for reminders yet.", "error");
    else toast("Couldn't send a test. Try again.", "error");
  };

  const removeDevice = async (id) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId(null);
    const { error } = await supabase.rpc("revoke_device", { p_device: id });
    if (error) return toast("Couldn't remove that device.", "error");
    if (id === thisDevice) { clearDevice(); await supabase.auth.signOut(); return; }
    toast("Device removed");
    loadDevices();
  };

  const on = !!me?.notify && !!hasSub;

  return (
    <div className="column">
      <header className="topbar">
        <button className="icon-btn glass" onClick={onBack} aria-label="Back to home"><ChevronLeft size={22} /></button>
        <h1 className="title">Settings</h1>
        <span className="spacer" />
      </header>

      <h2 className="section-h"><span>Reminders</span></h2>
      <div className="group">
        <div className="row">
          <BellRing size={20} color="var(--accent)" />
          <span style={{ flex: 1 }}>Bill reminders</span>
          <Toggle checked={on} onChange={toggleReminders} disabled={pushBusy || (!!blocker && !on)} label="Bill reminders" />
        </div>
        {on && <>
          <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <span className="k">Heads-up before a due date</span>
            <Segmented id="remind" value={me.remind_days} onChange={(v) => updateProfile({ remind_days: v })}
              options={[1, 3, 5, 7].map((d) => ({ value: d, label: d === 1 ? "1 day" : `${d} days` }))} />
          </div>
          <button className="row" style={{ width: "100%" }} onClick={sendTest}>
            <span style={{ flex: 1, textAlign: "left", color: "var(--accent)", fontWeight: 600 }}>Send a test notification</span>
          </button>
        </>}
      </div>
      <p className="field-note">
        {blocker && !on ? blocker : "Reminders come at 8 AM: before a bill is due, on the due date, and each day it's late. Only your own bills remind you."}
      </p>

      <h2 className="section-h"><span>Feel</span></h2>
      <div className="group">
        <div className="row">
          <Volume2 size={20} color="var(--accent)" />
          <span style={{ flex: 1 }}>Sounds and haptics</span>
          <Toggle checked={sounds} label="Sounds and haptics"
            onChange={(v) => { setSoundsEnabled(v); setSounds(v); if (v) setTimeout(() => play("toggleOn"), 30); }} />
        </div>
      </div>
      <p className="field-note">Soft clicks and taps on this device. They follow your phone's silent switch.</p>

      <h2 className="section-h"><span>Security</span></h2>
      <div className="group">
        <button className="row" style={{ width: "100%" }} onClick={() => setPinOpen(true)}>
          <KeyRound size={20} color="var(--accent)" />
          <span style={{ flex: 1, textAlign: "left" }}>Change PIN</span>
          <ChevronRight size={18} color="var(--text-3)" />
        </button>
        <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <span className="k">Lock after I leave the app for</span>
          <Segmented id="lock" value={me?.autolock_minutes ?? 5} onChange={(v) => updateProfile({ autolock_minutes: v })}
            options={[{ value: 0, label: "Never" }, { value: 1, label: "1 min" }, { value: 5, label: "5 min" }, { value: 15, label: "15 min" }, { value: 60, label: "1 hr" }]} />
        </div>
      </div>

      <h2 className="section-h"><span>Trusted devices</span></h2>
      <div className="group">
        {devices === null && <div className="row"><span className="spin" style={{ width: 18, height: 18 }} /></div>}
        {devices?.length === 0 && <div className="row"><span style={{ color: "var(--text-3)" }}>Couldn't load devices right now.</span></div>}
        {devices?.map((d) => (
          <div className="row" key={d.id}>
            <Smartphone size={20} color="var(--text-2)" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600 }}>{d.label}{d.id === thisDevice ? " (this one)" : ""}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--text-3)" }}>
                {d.last_seen_at ? `Last used ${shortDate(isoToNyDate(d.last_seen_at))}${d.last_profile_name ? ` by ${d.last_profile_name}` : ""}` : `Added ${shortDate(isoToNyDate(d.created_at))}`}
              </span>
            </span>
            <button className={"btn btn-sm " + (confirmId === d.id ? "btn-danger" : "btn-glass")} onClick={() => removeDevice(d.id)}>
              {confirmId === d.id ? "Remove?" : "Remove"}
            </button>
          </div>
        ))}
      </div>
      <p className="field-note">Removing a device means it needs the household key again before anyone can sign in on it.</p>

      <h2 className="section-h"><span>About</span></h2>
      <div className="group">
        <button className="row" style={{ width: "100%" }} onClick={onShowChangelog}>
          <Sparkles size={20} color="var(--accent)" />
          <span style={{ flex: 1, textAlign: "left" }}>What's new</span>
          <ChevronRight size={18} color="var(--text-3)" />
        </button>
        <div className="row"><Info size={20} color="var(--text-2)" /><span style={{ flex: 1 }}>Version</span><span className="v num">{VERSION}</span></div>
      </div>

      <AnimatePresence>{pinOpen && <ChangePin key="pin" onClose={() => setPinOpen(false)} toast={toast} />}</AnimatePresence>
    </div>
  );
}

function ChangePin({ onClose, toast }) {
  const [step, setStep] = useState("current");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [note, setNote] = useState("");

  const submit = async (pin) => {
    if (step === "current") { setCurrent(pin); setNote(""); setStep("new"); return { ok: true }; }
    if (step === "new") {
      if (pin === current) return { ok: false, message: "That's already your PIN. Pick a new one." };
      setNext(pin); setStep("confirm"); return { ok: true };
    }
    if (pin !== next) { setNext(""); setNote("Those didn't match. Enter your new PIN again."); setStep("new"); return { ok: true }; }
    const r = await authApi.changePin(current, pin);
    if (r.ok) { toast("PIN changed"); onClose(); return { ok: true }; }
    if (r.error === "wrong_current") { setCurrent(""); setNext(""); setNote("Your current PIN wasn't right. Start again."); setStep("current"); return { ok: true }; }
    if (r.error === "unavailable") { setNext(""); setNote("Pick a different PIN."); setStep("new"); return { ok: true }; }
    return { ok: false, message: "Couldn't change your PIN. Try again." };
  };

  const copy = {
    current: ["Enter your current PIN", note || "To keep your account safe."],
    new: ["Choose a new PIN", note || "6 digits you'll remember."],
    confirm: ["Confirm your new PIN", "Enter it once more."],
  }[step];
  return (
    <Sheet title="Change PIN" onClose={onClose}>
      <PinPad key={step + note} title={copy[0]} subtitle={copy[1]} onSubmit={submit} />
    </Sheet>
  );
}
