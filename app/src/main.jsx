import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "./styles.css";
import App from "./App.jsx";
import { initFeedback } from "./lib/feedback.js";
import { initViewport } from "./lib/viewport.js";

// Refuse to run inside someone else's frame (clickjacking protection; GitHub Pages can't send headers).
if (window.top !== window.self) {
  document.body.textContent = "";
  throw new Error("Ever After can't be framed.");
}

initViewport();
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
