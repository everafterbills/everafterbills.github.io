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

function tone({ f0, f1 = f0, dur = 0.05, type = "sine", gain = 0.04, delay = 0, attack = 0.004, glide = dur }) {
  const c = audio();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.002 + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.03);
}

// Sound themes. Every UI sound comes in three voices; the chosen theme also styles the tap ripple.
const mallet = (f, { delay = 0, gain = 0.1, dur = 0.06 } = {}) => {
  // Muted marimba: a quick pitch settle for definition, then a short warm ring.
  tone({ f0: f * 1.34, f1: f, glide: 0.008, dur, gain, attack: 0.0015, delay });
  tone({ f0: f * 2.76, dur: Math.min(0.016, dur), gain: gain * 0.2, attack: 0.001, delay });
};
const bell = (f, { delay = 0, gain = 0.075, dur = 0.14 } = {}) => {
  tone({ f0: f, dur, gain, attack: 0.003, delay });
  tone({ f0: f * 4, dur: 0.03, gain: gain * 0.13, attack: 0.002, delay });
};
const drop = (f, { delay = 0, gain = 0.11, dur = 0.06, down = false } = {}) =>
  tone({ f0: down ? f * 1.92 : f, f1: down ? f : f * 2.1, glide: 0.022, dur, gain, attack: 0.002, delay });

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C D E G A C: PIN digits climb in Chime
const ARP = [523.25, 659.25, 783.99, 1046.5];

export const SOUND_THEMES = [
  { value: "soft", label: "Soft" },
  { value: "chime", label: "Chime" },
  { value: "droplet", label: "Droplet" },
];
const THEMES = {
  soft: {
    tap: () => mallet(1050, { gain: 0.07, dur: 0.045 }),
    key: () => mallet(880, { gain: 0.11, dur: 0.055 }),
    del: () => mallet(720, { gain: 0.1, dur: 0.055 }),
    toggleOn: () => { mallet(784, { gain: 0.08 }); mallet(1046.5, { gain: 0.08, delay: 0.07 }); },
    toggleOff: () => { mallet(1046.5, { gain: 0.08 }); mallet(784, { gain: 0.075, delay: 0.07 }); },
    paid: () => [784, 988, 1318.5].forEach((f, i) => mallet(f, { gain: 0.09, dur: 0.1, delay: i * 0.06 })),
    success: () => ARP.forEach((f, i) => mallet(f, { gain: 0.09, dur: 0.14, delay: i * 0.075 })),
    error: () => { mallet(392, { gain: 0.12, dur: 0.08 }); mallet(330, { gain: 0.11, dur: 0.09, delay: 0.12 }); },
  },
  chime: {
    tap: () => bell(1318.5, { gain: 0.042, dur: 0.08 }),
    key: (n = 1) => bell(PENTA[Math.min(5, Math.max(0, n - 1))]),
    del: () => tone({ f0: 440, f1: 392, dur: 0.1, gain: 0.06, attack: 0.003 }),
    toggleOn: () => { bell(784, { gain: 0.06, dur: 0.12 }); bell(1046.5, { gain: 0.06, dur: 0.16, delay: 0.07 }); },
    toggleOff: () => { bell(1046.5, { gain: 0.06, dur: 0.12 }); bell(784, { gain: 0.055, dur: 0.16, delay: 0.07 }); },
    paid: () => [1046.5, 1318.5, 1568].forEach((f, i) => bell(f, { gain: 0.065, dur: 0.24, delay: i * 0.06 })),
    success: () => ARP.forEach((f, i) => bell(f, { gain: 0.07, dur: 0.32, delay: i * 0.08 })),
    error: () => { bell(659.25, { gain: 0.07, dur: 0.16 }); bell(523.25, { gain: 0.065, dur: 0.22, delay: 0.13 }); },
  },
  droplet: {
    tap: () => drop(700, { gain: 0.07, dur: 0.045 }),
    key: () => drop(560),
    del: () => drop(520, { down: true, gain: 0.1 }),
    toggleOn: () => { drop(600, { gain: 0.08 }); drop(800, { gain: 0.08, delay: 0.07 }); },
    toggleOff: () => drop(600, { down: true, gain: 0.085, dur: 0.07 }),
    paid: () => [520, 650, 780].forEach((f, i) => drop(f, { gain: 0.09, delay: i * 0.06 })),
    success: () => [400, 500, 600, 800].forEach((f, i) => drop(f, { gain: 0.085, dur: 0.07, delay: i * 0.075 })),
    error: () => { drop(260, { down: true, gain: 0.12, dur: 0.09 }); drop(230, { down: true, gain: 0.11, dur: 0.1, delay: 0.12 }); },
  },
};
// Stored under the key the keypad picker used, so the choice already made carries over.
let theme = getItem("ea.keySound", "soft");
if (!THEMES[theme]) theme = "soft";
export const soundTheme = () => theme;
export function setSoundTheme(v) { if (THEMES[v]) { theme = v; setItem("ea.keySound", v); } }
export function previewTheme() { [["tap"], ["key", 1], ["key", 2], ["key", 3], ["toggleOn"]].forEach(([n, a], i) => setTimeout(() => play(n, a), i * 130)); }

export function play(name = "tap", arg) { try { THEMES[theme][name]?.(arg); } catch { /* never let audio break the UI */ } }

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

// A soft ripple wherever a finger lands, styled by the sound theme.
let rippleLayer = null;
function ripple(x, y) {
  if (reduceMotion()) return;
  if (!rippleLayer || !rippleLayer.isConnected) {
    rippleLayer = document.createElement("div");
    rippleLayer.className = "ripple-layer";
    rippleLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(rippleLayer);
  }
  const el = document.createElement("span");
  el.className = "ripple ripple-" + theme;
  el.style.left = x + "px";
  el.style.top = y + "px";
  rippleLayer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

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
    if (e.button !== 0 || !e.isPrimary) return;
    const t = e.target instanceof Element ? e.target.closest(TARGET) : null;
    const host = t ? t.closest("[data-pulse-host]") || t : null;
    const s = t ? t.dataset.sound || (t.classList.contains("key") ? "none" : "tap") : "none";
    const x = e.clientX, y = e.clientY;
    const fire = () => { ripple(x, y); if (host) pulse(host, x, y); if (s !== "none") play(s); };
    if (e.pointerType === "mouse" || t?.classList.contains("key")) { fire(); return; }

    // A touch might be the start of a swipe. Wait a beat (or for the finger to lift) so swiping
    // never clicks or ripples. PIN keys skip this and respond on touch-down.
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", cleanup, true);
      window.removeEventListener("scroll", cleanup, true);
    };
    const onMove = (ev) => { if (Math.hypot(ev.clientX - x, ev.clientY - y) > 9) cleanup(); };
    const onUp = () => { cleanup(); fire(); };
    timer = setTimeout(() => { cleanup(); fire(); }, 85);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", cleanup, true);
    window.addEventListener("scroll", cleanup, true);
  }, { passive: true });

  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target.closest(TARGET) : null;
    if (t && t.dataset.haptic !== "none") haptic();
  }, { passive: true, capture: true });
}
