// Keeps the installed app current. iOS often resumes a home-screen app from memory instead of reloading it,
// so new versions could otherwise take days to show up. Checked when the app opens and whenever it comes back.
import { VERSION } from "../config.js";
import { getItem, setItem } from "./storage.js";

let checking = false;

async function check() {
  if (checking || document.hidden) return;
  checking = true;
  try {
    const res = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const { version } = await res.json();
    if (!version || version === VERSION) return;
    // Never interrupt someone filling in a form; try again next time the app comes back.
    if (document.querySelector(".sheet input, .sheet textarea, .sheet select")) return;
    // One attempt per version every few minutes, so a slow CDN can't cause a reload loop.
    const last = getItem("ea.reloadFor", null);
    if (last && last.v === version && Date.now() - last.at < 3 * 60000) return;
    setItem("ea.reloadFor", { v: version, at: Date.now() });
    setItem("ea.justUpdated", version);
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => null);
    await reg?.update().catch(() => {});
    location.replace("/?v=" + encodeURIComponent(version));
  } catch {
    /* offline or blocked: keep running the current version */
  } finally {
    checking = false;
  }
}

export function initUpdates() {
  // Tidy the cache-busting address left by an update.
  const params = new URLSearchParams(location.search);
  if (params.has("v")) {
    params.delete("v");
    const q = params.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
  }
  if (!import.meta.env.PROD) return;
  setTimeout(check, 800);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("pageshow", (e) => { if (e.persisted) check(); });
}

// Returns the version the app just updated to (once), so it can say so.
export function takeJustUpdated() {
  const v = getItem("ea.justUpdated", null);
  if (v) setItem("ea.justUpdated", null);
  return v === VERSION ? v : null;
}
