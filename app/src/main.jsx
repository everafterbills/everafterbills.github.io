import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "./styles.css";
import App from "./App.jsx";
import { initFeedback } from "./lib/feedback.js";
import { isIOS, isStandalone } from "./lib/platform.js";

// iOS 26 home-screen apps can lose a strip at the bottom of the screen (WebKit bug 301994).
// Measure it so bottom padding isn't counted twice.
function measureViewport() {
  let gap = 0;
  if (isIOS() && isStandalone()) {
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const full = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);
    gap = Math.round(full - window.innerHeight);
    if (gap < 20 || gap > 120) gap = 0;
  }
  document.documentElement.style.setProperty("--ios-gap", gap + "px");
}
measureViewport();
window.addEventListener("resize", measureViewport);
window.addEventListener("orientationchange", () => setTimeout(measureViewport, 300));

// Refuse to run inside someone else's frame (clickjacking protection; GitHub Pages can't send headers).
if (window.top !== window.self) {
  document.body.textContent = "";
  throw new Error("Ever After can't be framed.");
}

initFeedback();

const fontsReady = Promise.race([
  Promise.all([
    document.fonts?.load('italic 560 54px "Fraunces Variable"'),
    document.fonts?.load('520 34px "Fraunces Variable"'),
  ]).catch(() => {}),
  new Promise((r) => setTimeout(r, 700)),
]);
fontsReady.finally(() => {
  createRoot(document.getElementById("root")).render(<App />);
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
