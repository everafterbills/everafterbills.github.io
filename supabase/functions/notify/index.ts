
// ───────────────────────── Ever After — notify edge function ─────────────────────────
// Actions: vapid (public key), test (signed-in user), run (8 AM reminder job, needs x-cron-key)
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_ORIGIN = "https://everafterbills.github.io";
const TZ = "America/New_York";

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return keys.default ?? Object.values(keys)[0];
  } catch { return ""; }
}
const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function headersFor(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === APP_ORIGIN ? origin : APP_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}
const reply = (data: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers });

let vapidCache: { privateKey: CryptoKey; publicKey: string; subject: string } | null = null;
async function getVapid() {
  if (vapidCache) return vapidCache;
  const { data, error } = await admin.rpc("svc_get_secret", { p_name: "ever_after_vapid" });
  if (error) throw error;
  let stored = data ? JSON.parse(data) : null;
  if (!stored) {
    const fresh = await generateVapidKeys();
    stored = { privateJwk: fresh.privateJwk, publicKey: fresh.publicKey };
    const save = await admin.rpc("svc_set_secret", { p_name: "ever_after_vapid", p_value: JSON.stringify(stored) });
    if (save.error) throw save.error;
    // Re-read in case another run raced us.
    const again = await admin.rpc("svc_get_secret", { p_name: "ever_after_vapid" });
    if (!again.error && again.data) stored = JSON.parse(again.data);
  }
  vapidCache = { privateKey: await importVapidPrivate(stored.privateJwk), publicKey: stored.publicKey, subject: APP_ORIGIN };
  return vapidCache;
}

function nyParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: p.year + "-" + p.month + "-" + p.day, hour: Number(p.hour) };
}

const money = (n: number | null) =>
  n == null ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

function messageFor(r: { kind: string; bill_name: string; amount: number | null; due_date: string; days: number }) {
  const amt = money(r.amount);
  if (r.kind === "soon") {
    return { title: r.bill_name + " is due in " + r.days + " day" + (r.days === 1 ? "" : "s"), body: [amt, "due " + shortDate(r.due_date)].filter(Boolean).join(" · ") };
  }
  if (r.kind === "today") return { title: r.bill_name + " is due today", body: amt ? amt + " · tap to open Ever After" : "Tap to open Ever After" };
  const late = -r.days;
  return { title: r.bill_name + " is past due", body: [amt, late + " day" + (late === 1 ? "" : "s") + " late (due " + shortDate(r.due_date) + ")"].filter(Boolean).join(" · ") };
}

async function sendToProfile(profileId: string, payload: Record<string, unknown>) {
  const { data: subs, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("profile_id", profileId);
  if (error) throw error;
  const vapid = await getVapid();
  let delivered = 0;
  for (const s of subs ?? []) {
    try {
      const status = await sendPush(s, JSON.stringify(payload), vapid);
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else if (status >= 200 && status < 300) delivered++;
      else console.error("push status", status);
    } catch (e) { console.error("push failed", (e as Error)?.message); }
  }
  return delivered;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = headersFor(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405, headers);
  if (origin && origin !== APP_ORIGIN) return reply({ ok: false, error: "origin" }, 403, headers);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "vapid") {
      const v = await getVapid();
      return reply({ publicKey: v.publicKey }, 200, headers);
    }

    if (action === "test") {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: who, error } = await admin.auth.getUser(token);
      if (error || !who?.user) return reply({ ok: false, error: "unauthorized" }, 401, headers);
      const delivered = await sendToProfile(who.user.id, {
        title: "Ever After", body: "Notifications are on. Bill reminders arrive at 8 AM.", tag: "ea-test", url: "/",
      });
      return reply({ ok: true, delivered }, 200, headers);
    }

    if (action === "run") {
      const expected = await admin.rpc("svc_get_secret", { p_name: "ever_after_cron" });
      if (expected.error || !expected.data || req.headers.get("x-cron-key") !== expected.data) {
        return reply({ ok: false, error: "unauthorized" }, 401, headers);
      }
      const now = nyParts();
      if (now.hour < 8 || now.hour >= 12) return reply({ ok: true, skipped: "hour " + now.hour }, 200, headers);
      const { data: rows, error } = await admin.rpc("svc_pending_reminders", { p_today: now.date });
      if (error) throw error;
      const sent: { bill_id: string; period: string; kind: string }[] = [];
      for (const r of rows ?? []) {
        const msg = messageFor(r);
        await sendToProfile(r.profile_id, { ...msg, tag: r.bill_id + "-" + r.period + "-" + r.kind, url: "/" });
        sent.push({ bill_id: r.bill_id, period: r.period, kind: r.kind });
      }
      if (sent.length) {
        const log = await admin.rpc("svc_log_reminders", { p_today: now.date, p_items: sent });
        if (log.error) throw log.error;
      }
      return reply({ ok: true, date: now.date, reminders: sent.length }, 200, headers);
    }

    return reply({ ok: false, error: "unknown_action" }, 400, headers);
  } catch (e) {
    console.error("notify " + action + " failed:", (e as Error)?.message ?? e);
    return reply({ ok: false, error: "server" }, 500, headers);
  }
});

// ───────────────────────── Web Push (RFC 8291 + RFC 8292) ─────────────────────────
// Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) on standard WebCrypto.
// Shared by the notify edge function; tested locally with Node's WebCrypto.

const te = new TextEncoder();
const enc = (s) => te.encode(s);

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// ── VAPID keys ──
async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { privateJwk, publicKey: b64url(publicRaw) };
}

async function importVapidPrivate(privateJwk) {
  return crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function vapidJwt(audience, privateKey, subject, ttlSeconds = 12 * 3600) {
  const header = b64url(enc(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + ttlSeconds, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc(header + "." + claims)));
  return header + "." + claims + "." + b64url(sig);
}

// ── Payload encryption (aes128gcm, single record) ──
async function encryptPayload(uaPublicB64, authB64, payloadText) {
  const uaPublic = b64urlDecode(uaPublicB64);
  const authSecret = b64urlDecode(authB64);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(enc("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc("Content-Encoding: nonce\0"), 12);

  const plaintext = concat(enc(payloadText), new Uint8Array([2]));
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

// Sends one push. Returns the HTTP status (201/200 ok, 404/410 = subscription gone).
async function sendPush(subscription, payloadText, vapid) {
  const body = await encryptPayload(subscription.p256dh, subscription.auth, payloadText);
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await vapidJwt(audience, vapid.privateKey, vapid.subject);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
      Authorization: "vapid t=" + jwt + ", k=" + vapid.publicKey,
    },
    body,
  });
  try { await res.arrayBuffer(); } catch { /* ignore */ }
  return res.status;
}
