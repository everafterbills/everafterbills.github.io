import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";
import { supabase } from "./supabase.js";
import { getItem, setItem, removeItem } from "./storage.js";

const DEVICE_KEY = "ea.device";
export const getDevice = () => getItem(DEVICE_KEY);
export const saveDevice = (r) => setItem(DEVICE_KEY, { id: r.device_id, secret: r.device_secret });
export const clearDevice = () => removeItem(DEVICE_KEY);

async function callFn(name, payload, withSession = false) {
  const headers = { "Content-Type": "application/json", apikey: SUPABASE_KEY };
  if (withSession) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = "Bearer " + data.session.access_token;
  }
  let res;
  try {
    res = await fetch(SUPABASE_URL + "/functions/v1/" + name, { method: "POST", headers, body: JSON.stringify(payload) });
  } catch {
    return { ok: false, error: "offline" };
  }
  try { return await res.json(); } catch { return { ok: false, error: "server" }; }
}

export const authApi = {
  status() {
    const d = getDevice();
    return callFn("auth", { action: "status", device_id: d?.id, device_secret: d?.secret });
  },
  setup({ householdKey, nickPin, courtneyPin, label }) {
    return callFn("auth", { action: "setup", household_key: householdKey, nick_pin: nickPin, courtney_pin: courtneyPin, label });
  },
  enroll(householdKey, label) {
    return callFn("auth", { action: "enroll", household_key: householdKey, label });
  },
  async login(pin) {
    const d = getDevice();
    const r = await callFn("auth", { action: "login", device_id: d?.id, device_secret: d?.secret, pin });
    if (!r.ok) return r;
    let { error } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: "email" });
    if (error) ({ error } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: "magiclink" }));
    if (error) return { ok: false, error: "session" };
    return r;
  },
  changePin(currentPin, newPin) {
    return callFn("auth", { action: "change_pin", current_pin: currentPin, new_pin: newPin }, true);
  },
};

export const notifyApi = {
  vapidKey: () => callFn("notify", { action: "vapid" }),
  test: () => callFn("notify", { action: "test" }, true),
};
