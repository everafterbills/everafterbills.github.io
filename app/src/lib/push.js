import { supabase } from "./supabase.js";
import { notifyApi } from "./api.js";
import { pushSupported, isIOS, isStandalone } from "./platform.js";

function keyToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Why this device can't get notifications, or null if it can.
export function pushBlocker() {
  if (isIOS() && !isStandalone()) return "Open Ever After from your Home Screen to turn on reminders.";
  if (!pushSupported()) return "This browser can't show notifications.";
  if (Notification.permission === "denied") {
    return isIOS()
      ? "Notifications are blocked. Turn them on in iPhone Settings, Notifications, Ever After."
      : "Notifications are blocked for this site in your browser settings.";
  }
  return null;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// Must be called from a tap (iOS requires a user gesture for the permission prompt).
export async function enablePush() {
  const blocked = pushBlocker();
  if (blocked) return { ok: false, message: blocked };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, message: "Notifications weren't allowed." };
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await notifyApi.vapidKey();
  if (!publicKey) return { ok: false, message: "Couldn't reach the reminder service. Try again." };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  const j = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if (error) return { ok: false, message: "Couldn't save this device for reminders." };
  return { ok: true };
}

export async function disablePushHere() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}
