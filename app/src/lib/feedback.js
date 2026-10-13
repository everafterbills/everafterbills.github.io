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
    // Only a safety limiter: the default compressor settings would squash the click transients.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -4; comp.knee.value = 4; comp.ratio.value = 8;
    comp.attack.value = 0.001; comp.release.value = 0.06;
    out.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) ctx.resume().catch(() => {});
  return ctx;
}

function tone({ f0, f1 = f0, dur = 0.05, type = "sine", gain = 0.04, delay = 0, attack = 0.003 }) {
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

// A tiny burst of filtered noise: the crisp "tick" at the front of a modern UI click.
let noiseBuf = null;
function tick({ freq = 3600, q = 1.4, dur = 0.012, gain = 0.2, delay = 0 }) {
  const c = audio();
  if (!c || c.state !== "running") return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.05), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + 0.002 + delay;
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf;
  bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(t); src.stop(t + dur + 0.02);
}

const SOUNDS = {
  // Buttons: a light, glassy tick.
  tap: () => { tick({ freq: 3200, dur: 0.01, gain: 0.16 }); tone({ f0: 1250, f1: 820, dur: 0.022, gain: 0.05 }); },
  // PIN digits: crisp and short, like a premium keyboard.
  key: () => { tick({ freq: 4200, q: 1.1, dur: 0.009, gain: 0.26 }); tone({ f0: 1580, f1: 1060, dur: 0.028, gain: 0.07 }); },
  del: () => { tick({ freq: 2600, q: 1.1, dur: 0.01, gain: 0.22 }); tone({ f0: 980, f1: 700, dur: 0.03, gain: 0.07 }); },
  toggleOn: () => { tick({ freq: 3400, dur: 0.008, gain: 0.12 }); tone({ f0: 990, dur: 0.05, gain: 0.06 }); tone({ f0: 1485, dur: 0.07, gain: 0.055, delay: 0.045 }); },
  toggleOff: () => { tick({ freq: 2800, dur: 0.008, gain: 0.12 }); tone({ f0: 1100, f1: 760, dur: 0.07, gain: 0.06 }); },
  // Paid: a quick bright sparkle that resolves upward.
  paid: () => { tick({ freq: 5200, dur: 0.012, gain: 0.1 }); [1318.5, 1760, 2637].forEach((f, i) => tone({ f0: f, dur: 0.16, gain: 0.055, delay: 0.02 + i * 0.05 })); },
  // Signed in: a clean two-note chime.
  success: () => { tone({ f0: 1046.5, dur: 0.22, gain: 0.06, attack: 0.006 }); tone({ f0: 2093, dur: 0.22, gain: 0.018, attack: 0.006 }); tone({ f0: 1568, dur: 0.3, gain: 0.06, delay: 0.09, attack: 0.006 }); },
  // Wrong PIN: two soft, low taps (no buzzer).
  error: () => { tone({ f0: 330, f1: 250, dur: 0.07, gain: 0.12 }); tone({ f0: 300, f1: 220, dur: 0.08, gain: 0.1, delay: 0.1 }); },
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
    const s = t.dataset.sound || (t.classList.contains("key") ? "none" : "tap");
    const x = e.clientX, y = e.clientY;
    const fire = () => { pulse(host, x, y); if (s !== "none") play(s); };
    if (e.pointerType === "mouse" || t.classList.contains("key")) { fire(); return; }

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
