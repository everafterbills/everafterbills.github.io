// Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) on standard WebCrypto.
// Shared by the notify edge function; tested locally with Node's WebCrypto.

const te = new TextEncoder();
export const enc = (s) => te.encode(s);

export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// ── VAPID keys ──
export async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { privateJwk, publicKey: b64url(publicRaw) };
}

export async function importVapidPrivate(privateJwk) {
  return crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function vapidJwt(audience, privateKey, subject, ttlSeconds = 12 * 3600) {
  const header = b64url(enc(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + ttlSeconds, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc(header + "." + claims)));
  return header + "." + claims + "." + b64url(sig);
}

// ── Payload encryption (aes128gcm, single record) ──
export async function encryptPayload(uaPublicB64, authB64, payloadText) {
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
export async function sendPush(subscription, payloadText, vapid) {
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
