// Ever After — auth edge function (verify_jwt off; every action does its own checks)
// Actions: status, setup, enroll, login, change_pin
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_ORIGIN = "https://everafterbills.github.io";
const ALLOWED = new Set([APP_ORIGIN]);
const EMAIL_DOMAIN = "everafterbills.github.io";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function headersFor(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED.has(origin) ? origin : APP_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}
const reply = (data: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers });

async function ensureUser(slug: "nick" | "courtney"): Promise<string> {
  const email = slug + "@" + EMAIL_DOMAIN;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { slug } });
  if (!created.error && created.data?.user) return created.data.user.id;
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  const found = data.users.find((u) => u.email === email);
  if (!found) throw created.error ?? new Error("user create failed");
  return found.id;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = headersFor(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405, headers);
  if (origin && !ALLOWED.has(origin)) return reply({ ok: false, error: "origin" }, 403, headers);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ ok: false, error: "bad_json" }, 400, headers); }
  const action = str(body.action, 20);

  try {
    if (action === "status") {
      const { data, error } = await admin.rpc("svc_status", {
        p_device: uuidOrNull(body.device_id), p_secret: str(body.device_secret, 128) || null,
      });
      if (error) throw error;
      return reply(data, 200, headers);
    }

    if (action === "setup") {
      const status = await admin.rpc("svc_status", { p_device: null, p_secret: null });
      if (status.error) throw status.error;
      if (status.data?.setup_done) return reply({ ok: false, error: "already_setup" }, 200, headers);
      const nickPin = str(body.nick_pin, 6), courtneyPin = str(body.courtney_pin, 6);
      if (!/^\d{6}$/.test(nickPin) || !/^\d{6}$/.test(courtneyPin)) return reply({ ok: false, error: "bad_pin" }, 200, headers);
      if (nickPin === courtneyPin) return reply({ ok: false, error: "same_pin" }, 200, headers);
      if (str(body.household_key, 200).trim().length < 10) return reply({ ok: false, error: "weak_key" }, 200, headers);
      const nick = await ensureUser("nick");
      const courtney = await ensureUser("courtney");
      const { data, error } = await admin.rpc("svc_setup", {
        p_household_key: str(body.household_key, 200), p_nick_uid: nick, p_nick_pin: nickPin,
        p_courtney_uid: courtney, p_courtney_pin: courtneyPin, p_label: str(body.label, 40),
      });
      if (error) throw error;
      return reply(data, 200, headers);
    }

    if (action === "enroll") {
      const { data, error } = await admin.rpc("svc_enroll", {
        p_household_key: str(body.household_key, 200), p_label: str(body.label, 40),
      });
      if (error) throw error;
      return reply(data, 200, headers);
    }

    if (action === "login") {
      const { data, error } = await admin.rpc("svc_login", {
        p_device: uuidOrNull(body.device_id), p_secret: str(body.device_secret, 128), p_pin: str(body.pin, 6),
      });
      if (error) throw error;
      if (!data?.ok) return reply(data, 200, headers);
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: data.slug + "@" + EMAIL_DOMAIN });
      if (link.error) throw link.error;
      return reply({ ok: true, slug: data.slug, name: data.name, token_hash: link.data.properties.hashed_token }, 200, headers);
    }

    if (action === "change_pin") {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: who, error: whoErr } = await admin.auth.getUser(token);
      if (whoErr || !who?.user) return reply({ ok: false, error: "unauthorized" }, 401, headers);
      const { data, error } = await admin.rpc("svc_change_pin", {
        p_profile: who.user.id, p_current: str(body.current_pin, 6), p_new: str(body.new_pin, 6),
      });
      if (error) throw error;
      return reply(data, 200, headers);
    }

    return reply({ ok: false, error: "unknown_action" }, 400, headers);
  } catch (e) {
    console.error("auth " + action + " failed:", (e as Error)?.message ?? e);
    return reply({ ok: false, error: "server" }, 500, headers);
  }
});
