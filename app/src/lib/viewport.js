// Keeps the app clear of the bottom of the screen on every iPhone layout, and stops iOS from
// dragging the whole app around when a swipe has nothing to scroll.
import { isIOS, isMobile, isStandalone } from "./platform.js";
import { getItem, setItem } from "./storage.js";

function insets() {
  const p = document.createElement("div");
  p.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(p);
  const cs = getComputedStyle(p);
  const r = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  p.remove();
  return r;
}

// iOS 26 home-screen apps can lose a strip at the bottom of the screen (WebKit bug 301994), in one of three ways:
//  A. the page gets shorter and the strip sits below it (nothing to avoid),
//  B. the page stays full height and the strip is drawn over its bottom edge (keep clear of it),
//  C. the page is pushed down from the top and still reaches the bottom (normal home-indicator space).
// iOS can switch between these while the app is open, so this runs on every layout change.
let lastGuard = -1;
export function measureBottom() {
  const { top, bottom } = insets();
  let guard = bottom;
  if (isIOS() && isStandalone()) {
    const portrait = window.innerHeight >= window.innerWidth;
    const full = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);
    const diff = Math.round(full - window.innerHeight);
    if (portrait && diff >= 20 && diff <= 140) {
      if (top > 0) { guard = 0; setItem("ea.strip", diff); }  // A
      else guard = bottom;                                     // C
    } else if (portrait && diff < 20) {
      const strip = getItem("ea.strip", 0) || top;            // B (or a normal full-height page)
      guard = Math.max(bottom, Math.min(strip, 96));
    }
  }
  guard = Math.round(guard);
  if (guard !== lastGuard) {
    lastGuard = guard;
    document.documentElement.style.setProperty("--bottom-guard", guard + "px");
  }
}

export function initViewport() {
  measureBottom();
  let t = 0;
  const later = () => { measureBottom(); clearTimeout(t); t = setTimeout(measureBottom, 350); };
  window.addEventListener("resize", later);
  window.visualViewport?.addEventListener("resize", later);
  window.addEventListener("orientationchange", later);
  window.addEventListener("pageshow", later);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { later(); setTimeout(measureBottom, 1000); } });
  setTimeout(measureBottom, 600);

  // The install page in mobile Safari scrolls like a normal web page; everything else is the app.
  if (isMobile() && !isStandalone()) return;
  document.documentElement.classList.add("app-mode");

  // A swipe that can't scroll anything would otherwise rubber-band the whole app (fixed layers included).
  // Decided once per gesture, on its first move.
  let startY = 0, startX = 0, verdict = null;
  document.addEventListener("touchstart", (e) => {
    const p = e.touches[0];
    if (p) { startY = p.clientY; startX = p.clientX; }
    verdict = null;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!e.cancelable || e.touches.length !== 1 || e.defaultPrevented) return;
    if (verdict === null) {
      const p = e.touches[0];
      const dy = p.clientY - startY, dx = p.clientX - startX;
      verdict = Math.abs(dx) > Math.abs(dy) ? "allow" : "block";
      for (let el = e.target instanceof Element ? e.target : null; verdict === "block" && el && el !== document.body; el = el.parentElement) {
        if (el.matches("input, textarea, select, [contenteditable]")) verdict = "allow";
        const oy = getComputedStyle(el).overflowY;
        // A scrollable area takes the swipe and bounces on its own at the edges (overscroll-behavior: contain).
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight - el.clientHeight > 1) verdict = "allow";
      }
    }
    if (verdict === "block") e.preventDefault();
  }, { passive: false });
}

