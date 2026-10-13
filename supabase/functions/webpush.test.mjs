// Round-trip test: encrypt as the server, decrypt as the browser would (RFC 8291), verify VAPID JWT.
import { encryptPayload, generateVapidKeys, importVapidPrivate, vapidJwt, b64url, b64urlDecode, hkdf, enc, concat } from "./webpush.js";
import assert from "node:assert/strict";

// Fake browser subscription keys
const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));

const message = JSON.stringify({ title: "Car loan is due today", body: "$300.00", tag: "t" });
const body = await encryptPayload(b64url(uaPublic), b64url(authSecret), message);

// Browser-side decrypt
const salt = body.slice(0, 16);
const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
const idlen = body[20];
const asPublic = body.slice(21, 21 + idlen);
const ct = body.slice(21 + idlen);
assert.equal(rs, 4096); assert.equal(idlen, 65);
const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
const ikm = await hkdf(authSecret, ecdh, concat(enc("WebPush: info\0"), uaPublic, asPublic), 32);
const cek = await hkdf(salt, ikm, enc("Content-Encoding: aes128gcm\0"), 16);
const nonce = await hkdf(salt, ikm, enc("Content-Encoding: nonce\0"), 12);
const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct));
assert.equal(plain[plain.length - 1], 2, "last-record delimiter");
const text = new TextDecoder().decode(plain.slice(0, -1));
assert.equal(text, message);
console.log("payload round-trip OK:", text);

// VAPID
const v = await generateVapidKeys();
assert.equal(b64urlDecode(v.publicKey).length, 65);
const priv = await importVapidPrivate(v.privateJwk);
const jwt = await vapidJwt("https://web.push.apple.com", priv, "https://everafterbills.github.io");
const [h, c, s] = jwt.split(".");
const pub = await crypto.subtle.importKey("raw", b64urlDecode(v.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64urlDecode(s), enc(`${h}.${c}`));
assert.ok(ok, "VAPID signature verifies");
const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
assert.equal(claims.aud, "https://web.push.apple.com");
assert.equal(b64urlDecode(s).length, 64, "ES256 raw signature");
console.log("VAPID JWT OK:", claims);
