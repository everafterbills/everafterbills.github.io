import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "./styles.css";
import App from "./App.jsx";

// Refuse to run inside someone else's frame (clickjacking protection; GitHub Pages can't send headers).
if (window.top !== window.self) {
  document.body.textContent = "";
  throw new Error("Ever After can't be framed.");
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
