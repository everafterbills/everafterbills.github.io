// Subtle UI feedback: synthesized click sounds (Web Audio, no files), haptic ticks, and tap pulses.
import { getItem, setItem } from "./storage.js";
import { isIOS } from "./platform.js";

let enabled = getItem("ea.sound", true);
let onSilent = getItem("ea.soundOnSilent", false);
export const soundsEnabled = () => enabled;
export function setSoundsEnabled(v) { enabled = !!v; setItem("ea.sound", enabled); }
export const soundsOnSilent = () => onSilent;
// "playback" ignores the iPhone silent switch (and pauses other audio like music); "ambient" respects it.
function applySession() {
  try { if (navigator.audioSession) navigator.audioSession.type = onSilent ? "playback" : "ambient"; } catch { /* older Safari */ }
}
export function setSoundsOnSilent(v) { onSilent = !!v; setItem("ea.soundOnSilent", onSilent); applySession(); }

let ctx = null, out = null;
function audio(create = true) {
  if (!enabled) return null;
  if (!ctx && create) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    applySession();
    ctx = new AC({ latencyHint: "interactive" });
    out = ctx.createGain();
    out.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    out.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) ctx.resume().catch(() => {});
  return ctx;
}

function tone({ f0, f1 = f0, dur = 0.05, type = "sine", gain = 0.04, delay = 0, attack = 0.004 }) {
  const c = audio();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.002 + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.03);
}

const SOUNDS = {
  tap: () => { tone({ f0: 1700, f1: 900, dur: 0.04, gain: 0.09 }); tone({ f0: 3400, f1: 2400, dur: 0.012, gain: 0.025 }); },
  key: () => { tone({ f0: 720, f1: 470, dur: 0.07, type: "triangle", gain: 0.13 }); tone({ f0: 2600, f1: 1800, dur: 0.01, gain: 0.03 }); },
  toggleOn: () => { tone({ f0: 880, dur: 0.06, gain: 0.08 }); tone({ f0: 1320, dur: 0.09, gain: 0.07, delay: 0.05 }); },
  toggleOff: () => tone({ f0: 760, f1: 520, dur: 0.09, gain: 0.08 }),
  paid: () => [784, 988, 1319].forEach((f, i) => tone({ f0: f, dur: 0.2, gain: 0.08, delay: i * 0.055 })),
  success: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ f0: f, dur: 0.26, gain: 0.07, delay: i * 0.07 })),
  error: () => { tone({ f0: 230, f1: 160, dur: 0.12, type: "triangle", gain: 0.14 }); tone({ f0: 210, f1: 150, dur: 0.13, type: "triangle", gain: 0.11, delay: 0.13 }); },
};
export function play(name = "tap") { try { SOUNDS[name]?.(); } catch { /* never let audio break the UI */ } }

// iOS Safari has no vibrate(); toggling a hidden native switch gives a light system haptic (iOS 18+).
let hapticLabel = null;
export function haptic() {
  if (!enabled) return;
  // Don't steal focus (and close the keyboard) while someone is typing.
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== "ea-haptic") return;
  try {
    if (navigator.vibrate && !isIOS()) { navigator.vibrate(6); return; }
    if (!isIOS()) return;
    if (!hapticLabel) {
      const hide = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
      const input = document.createElement("input");
      input.type = "checkbox"; input.id = "ea-haptic"; input.setAttribute("switch", ""); input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true"); input.style.cssText = hide;
      const label = document.createElement("label");
      label.htmlFor = "ea-haptic"; label.setAttribute("aria-hidden", "true"); label.style.cssText = hide;
      document.body.append(input, label);
      hapticLabel = label;
    }
    hapticLabel.click();
  } catch { /* unsupported */ }
}

const TARGET = 'button:not(:disabled), a.btn, .key:not(:disabled)';
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function pulse(host, x, y) {
  if (reduceMotion()) return;
  const r = host.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.1;
  const el = document.createElement("span");
  el.className = "tap-pulse";
  el.style.width = el.style.height = size + "px";
  el.style.left = x - r.left + "px";
  el.style.top = y - r.top + "px";
  host.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 900);
}

export function initFeedback() {
  // Unlock audio on the first real gesture (Safari only allows it on touchend/click).
  const unlock = () => {
    const c = audio();
    if (!c) return;
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch { /* ignore */ }
  };
  document.addEventListener("touchend", unlock, { passive: true });
  document.addEventListener("click", unlock, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && ctx) audio(false); });
  // Lets :active styles work on iOS.
  document.addEventListener("touchstart", () => {}, { passive: true });

  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const t = e.target instanceof Element ? e.target.closest(TARGET) : null;
    if (!t) return;
    const host = t.closest("[data-pulse-host]") || t;
    pulse(host, e.clientX, e.clientY);
    const s = t.dataset.sound || (t.classList.contains("key") ? "none" : "tap");
    if (s !== "none") play(s);
  }, { passive: true });

  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target.closest(TARGET) : null;
    if (t && t.dataset.haptic !== "none") haptic();
  }, { passive: true, capture: true });
}
