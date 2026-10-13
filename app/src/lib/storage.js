// localStorage can throw (private mode, storage disabled); never let that crash the app.
export function getItem(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function setItem(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
export function removeItem(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
