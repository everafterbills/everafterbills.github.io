-- Ever After — schema, security, and private auth store
-- Run once on a fresh project.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ───────────────────────── Profiles ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique check (slug in ('nick','courtney')),
  display_name text not null,
  notify boolean not null default true,
  remind_days int not null default 3 check (remind_days between 1 and 14),
  autolock_minutes int not null default 5 check (autolock_minutes in (0,1,5,15,60)),
  created_at timestamptz not null default now()
);

-- ───────────────────────── Private auth store ─────────────────────────
create table if not exists private.household (
  id int primary key default 1 check (id = 1),
  key_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists private.pins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.devices (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  label text not null default 'Device',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_profile uuid references public.profiles(id) on delete set null,
  failed_count int not null default 0,
  locked_until timestamptz,
  revoked_at timestamptz
);

create table if not exists private.enroll_attempts (
  id bigserial primary key,
  at timestamptz not null default now(),
  ok boolean not null
);

-- ───────────────────────── Bills ─────────────────────────
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'Other' check (char_length(category) between 1 and 40),
  schedule text not null default 'monthly' check (schedule in ('monthly','yearly','per_use','balance')),
  due_day int check (due_day between 1 and 31),
  due_month int check (due_month between 1 and 12),
  amount numeric(12,2) check (amount >= 0),
  amount_varies boolean not null default false,
  balance numeric(12,2) check (balance >= 0),
  autopay boolean not null default false,
  url text check (url is null or url ~* '^https://[^\s]+$'),
  verification text check (verification is null or char_length(verification) <= 60),
  notes text check (notes is null or char_length(notes) <= 1000),
  needs_review text check (needs_review is null or char_length(needs_review) <= 300),
  has_login boolean not null default false,
  start_month date not null default (date_trunc('month', (now() at time zone 'America/New_York')))::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint yearly_needs_month check (schedule <> 'yearly' or due_month is not null)
);
create index if not exists bills_owner_idx on public.bills(owner_id);

create table if not exists public.bill_periods (
  bill_id uuid not null references public.bills(id) on delete cascade,
  period date not null check (extract(day from period) = 1),
  amount numeric(12,2) check (amount >= 0),
  paid boolean,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (bill_id, period)
);

create table if not exists private.bill_credentials (
  bill_id uuid primary key references public.bills(id) on delete cascade,
  username_enc bytea,
  password_enc bytea,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint ~* '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_profile_idx on public.push_subscriptions(profile_id);

create table if not exists private.notification_log (
  bill_id uuid not null references public.bills(id) on delete cascade,
  period date not null,
  kind text not null,
  sent_on date not null,
  primary key (bill_id, period, kind, sent_on)
);

-- Seed bills staged privately; moved into public.bills during first-time setup.
create table if not exists private.seed_bills (
  id bigserial primary key,
  owner_slug text not null check (owner_slug in ('nick','courtney')),
  name text not null,
  category text not null,
  schedule text not null,
  due_day int,
  due_month int,
  amount numeric(12,2),
  amount_varies boolean not null default false,
  balance numeric(12,2),
  autopay boolean not null default false,
  url text,
  verification text,
  notes text,
  needs_review text,
  username_enc bytea
);

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

create or replace function private.cred_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'ever_after_cred_key' limit 1;
$$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists bills_touch on public.bills;
create trigger bills_touch before update on public.bills for each row execute function private.touch_updated_at();
drop trigger if exists periods_touch on public.bill_periods;
create trigger periods_touch before update on public.bill_periods for each row execute function private.touch_updated_at();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.bills enable row level security;
alter table public.bill_periods enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using ((select public.is_member()));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists bills_read on public.bills;
create policy bills_read on public.bills for select to authenticated using ((select public.is_member()));
drop policy if exists bills_insert on public.bills;
create policy bills_insert on public.bills for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists bills_update on public.bills;
create policy bills_update on public.bills for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists bills_delete on public.bills;
create policy bills_delete on public.bills for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists periods_read on public.bill_periods;
create policy periods_read on public.bill_periods for select to authenticated using ((select public.is_member()));
drop policy if exists periods_insert on public.bill_periods;
create policy periods_insert on public.bill_periods for insert to authenticated
  with check (exists (select 1 from public.bills b where b.id = bill_id and b.owner_id = (select auth.uid())));
drop policy if exists periods_update on public.bill_periods;
create policy periods_update on public.bill_periods for update to authenticated
  using (exists (select 1 from public.bills b where b.id = bill_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.bills b where b.id = bill_id and b.owner_id = (select auth.uid())));
drop policy if exists periods_delete on public.bill_periods;
create policy periods_delete on public.bill_periods for delete to authenticated
  using (exists (select 1 from public.bills b where b.id = bill_id and b.owner_id = (select auth.uid())));

drop policy if exists push_own_read on public.push_subscriptions;
create policy push_own_read on public.push_subscriptions for select to authenticated using (profile_id = (select auth.uid()));
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (profile_id = (select auth.uid()));

-- Table privileges (nothing is exposed automatically on this project).
revoke all on public.profiles, public.bills, public.bill_periods, public.push_subscriptions from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (notify, remind_days, autolock_minutes) on public.profiles to authenticated;
grant select, delete on public.bills to authenticated;
grant insert (owner_id, name, category, schedule, due_day, due_month, amount, amount_varies, balance, autopay, url, verification, notes, needs_review, start_month)
  on public.bills to authenticated;
grant update (name, category, schedule, due_day, due_month, amount, amount_varies, balance, autopay, url, verification, notes, needs_review)
  on public.bills to authenticated;
grant select, insert, update, delete on public.bill_periods to authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.profiles, public.bills, public.bill_periods, public.push_subscriptions to service_role;

-- ───────────────────────── App RPCs (signed-in members) ─────────────────────────
create or replace function public.get_bill_login(p_bill uuid)
returns table(username text, password text)
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not exists (select 1 from public.bills where id = p_bill and owner_id = (select auth.uid())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  k := private.cred_key();
  return query
    select case when c.username_enc is null then null else extensions.pgp_sym_decrypt(c.username_enc, k) end,
           case when c.password_enc is null then null else extensions.pgp_sym_decrypt(c.password_enc, k) end
    from private.bill_credentials c where c.bill_id = p_bill;
end $$;

create or replace function public.set_bill_login(p_bill uuid, p_username text, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
declare k text; u text; p text;
begin
  if not exists (select 1 from public.bills where id = p_bill and owner_id = (select auth.uid())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  u := nullif(btrim(coalesce(p_username, '')), '');
  p := nullif(coalesce(p_password, ''), '');
  if char_length(coalesce(u,'')) > 200 or char_length(coalesce(p,'')) > 200 then
    raise exception 'too long' using errcode = '22001';
  end if;
  k := private.cred_key();
  if u is null and p is null then
    delete from private.bill_credentials where bill_id = p_bill;
  else
    insert into private.bill_credentials(bill_id, username_enc, password_enc, updated_at)
    values (p_bill,
            case when u is null then null else extensions.pgp_sym_encrypt(u, k, 'cipher-algo=aes256') end,
            case when p is null then null else extensions.pgp_sym_encrypt(p, k, 'cipher-algo=aes256') end,
            now())
    on conflict (bill_id) do update set username_enc = excluded.username_enc,
                                        password_enc = excluded.password_enc,
                                        updated_at = now();
  end if;
  update public.bills set has_login = (u is not null or p is not null) where id = p_bill;
end $$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_endpoint !~* '^https://' or char_length(p_endpoint) > 1000 then raise exception 'bad endpoint'; end if;
  insert into public.push_subscriptions(profile_id, endpoint, p256dh, auth)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create or replace function public.list_devices()
returns table(id uuid, label text, created_at timestamptz, last_seen_at timestamptz, last_profile_name text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select d.id, d.label, d.created_at, d.last_seen_at, p.display_name
    from private.devices d left join public.profiles p on p.id = d.last_profile
    where d.revoked_at is null
    order by d.last_seen_at desc nulls last, d.created_at desc;
end $$;

create or replace function public.revoke_device(p_device uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception 'not allowed' using errcode = '42501'; end if;
  update private.devices set revoked_at = now() where id = p_device and revoked_at is null;
end $$;

-- ───────────────────────── Service-only RPCs (edge functions) ─────────────────────────
create or replace function public.svc_status(p_device uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d private.devices;
begin
  if p_device is not null and p_secret is not null then
    select * into d from private.devices
    where id = p_device and revoked_at is null
      and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
  end if;
  return jsonb_build_object(
    'setup_done', exists (select 1 from private.household),
    'trusted', d.id is not null,
    'locked_until', d.locked_until);
end $$;

create or replace function private.new_device(p_label text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_secret text; v_id uuid;
begin
  v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.devices(secret_hash, label)
  values (encode(extensions.digest(v_secret, 'sha256'), 'hex'),
          coalesce(nullif(left(btrim(coalesce(p_label,'')), 40), ''), 'Device'))
  returning id into v_id;
  return jsonb_build_object('device_id', v_id, 'device_secret', v_secret);
end $$;

create or replace function public.svc_setup(p_household_key text, p_nick_uid uuid, p_nick_pin text,
                                            p_courtney_uid uuid, p_courtney_pin text, p_label text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_key text := btrim(coalesce(p_household_key, '')); v_dev jsonb;
begin
  perform pg_advisory_xact_lock(424242);
  if exists (select 1 from private.household) then
    return jsonb_build_object('ok', false, 'error', 'already_setup');
  end if;
  if char_length(v_key) < 10 then return jsonb_build_object('ok', false, 'error', 'weak_key'); end if;
  if coalesce(p_nick_pin,'') !~ '^\d{6}$' or coalesce(p_courtney_pin,'') !~ '^\d{6}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_pin');
  end if;
  if p_nick_pin = p_courtney_pin then return jsonb_build_object('ok', false, 'error', 'same_pin'); end if;

  insert into private.household(key_hash) values (extensions.crypt(v_key, extensions.gen_salt('bf', 10)));

  insert into public.profiles(id, slug, display_name) values
    (p_nick_uid, 'nick', 'Nick'), (p_courtney_uid, 'courtney', 'Courtney')
  on conflict (id) do nothing;

  insert into private.pins(profile_id, pin_hash) values
    (p_nick_uid, extensions.crypt(p_nick_pin, extensions.gen_salt('bf', 10))),
    (p_courtney_uid, extensions.crypt(p_courtney_pin, extensions.gen_salt('bf', 10)))
  on conflict (profile_id) do update set pin_hash = excluded.pin_hash, updated_at = now();

  -- Move staged bills into the live tables.
  with moved as (
    insert into public.bills(owner_id, name, category, schedule, due_day, due_month, amount, amount_varies,
                             balance, autopay, url, verification, notes, needs_review, has_login)
    select case s.owner_slug when 'nick' then p_nick_uid else p_courtney_uid end,
           s.name, s.category, s.schedule, s.due_day, s.due_month, s.amount, s.amount_varies,
           s.balance, s.autopay, s.url, s.verification, s.notes, s.needs_review, s.username_enc is not null
    from private.seed_bills s order by s.id
    returning id, name, owner_id
  )
  insert into private.bill_credentials(bill_id, username_enc)
  select m.id, s.username_enc
  from moved m
  join private.seed_bills s on s.name = m.name
    and m.owner_id = case s.owner_slug when 'nick' then p_nick_uid else p_courtney_uid end
  where s.username_enc is not null;

  delete from private.seed_bills where true;

  v_dev := private.new_device(p_label);
  return jsonb_build_object('ok', true) || v_dev;
end $$;

create or replace function public.svc_enroll(p_household_key text, p_label text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_fails int; v_oldest timestamptz;
begin
  select key_hash into v_hash from private.household;
  if v_hash is null then return jsonb_build_object('ok', false, 'error', 'not_setup'); end if;
  select count(*), min(at) into v_fails, v_oldest from private.enroll_attempts
    where not ok and at > now() - interval '1 hour';
  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', v_oldest + interval '1 hour');
  end if;
  if extensions.crypt(btrim(coalesce(p_household_key,'')), v_hash) <> v_hash then
    insert into private.enroll_attempts(ok) values (false);
    return jsonb_build_object('ok', false, 'error', 'bad_key', 'tries_left', greatest(0, 4 - v_fails));
  end if;
  insert into private.enroll_attempts(ok) values (true);
  return jsonb_build_object('ok', true) || private.new_device(p_label);
end $$;

create or replace function public.svc_login(p_device uuid, p_secret text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d private.devices; v_profile uuid; v_slug text; v_name text; v_lock interval; v_count int;
begin
  select * into d from private.devices
  where id = p_device and revoked_at is null
    and secret_hash = encode(extensions.digest(coalesce(p_secret,''), 'sha256'), 'hex')
  for update;
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'untrusted'); end if;
  if d.locked_until is not null and d.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', d.locked_until);
  end if;

  if coalesce(p_pin,'') ~ '^\d{6}$' then
    select p.profile_id into v_profile from private.pins p
    where p.pin_hash = extensions.crypt(p_pin, p.pin_hash) limit 1;
  end if;

  if v_profile is null then
    update private.devices set failed_count = failed_count + 1 where id = d.id
      returning failed_count into v_count;
    if v_count >= 15 then
      update private.devices set revoked_at = now() where id = d.id;
      return jsonb_build_object('ok', false, 'error', 'revoked');
    elsif v_count % 5 = 0 then
      v_lock := case when v_count = 5 then interval '5 minutes' else interval '30 minutes' end;
      update private.devices set locked_until = now() + v_lock where id = d.id;
      return jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', now() + v_lock);
    end if;
    return jsonb_build_object('ok', false, 'error', 'bad_pin', 'tries_left', 5 - (v_count % 5));
  end if;

  update private.devices set failed_count = 0, locked_until = null, last_seen_at = now(), last_profile = v_profile
  where id = d.id;
  select slug, display_name into v_slug, v_name from public.profiles where id = v_profile;
  return jsonb_build_object('ok', true, 'profile_id', v_profile, 'slug', v_slug, 'name', v_name);
end $$;

create or replace function public.svc_change_pin(p_profile uuid, p_current text, p_new text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  select pin_hash into v_hash from private.pins where profile_id = p_profile;
  if v_hash is null or extensions.crypt(coalesce(p_current,''), v_hash) <> v_hash then
    return jsonb_build_object('ok', false, 'error', 'wrong_current');
  end if;
  if coalesce(p_new,'') !~ '^\d{6}$' then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  if p_new = p_current then return jsonb_build_object('ok', false, 'error', 'same_as_current'); end if;
  if exists (select 1 from private.pins where profile_id <> p_profile and pin_hash = extensions.crypt(p_new, pin_hash)) then
    return jsonb_build_object('ok', false, 'error', 'unavailable');
  end if;
  update private.pins set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), updated_at = now()
  where profile_id = p_profile;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.svc_get_secret(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if p_name not in ('ever_after_vapid', 'ever_after_cron') then raise exception 'not allowed'; end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1);
end $$;

create or replace function public.svc_set_secret(p_name text, p_value text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_name not in ('ever_after_vapid') then raise exception 'not allowed'; end if;
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then perform vault.create_secret(p_value, p_name);
  else perform vault.update_secret(v_id, p_value); end if;
end $$;

-- Reminders due "today" (America/New_York date passed in), not yet sent.
create or replace function public.svc_pending_reminders(p_today date)
returns table(profile_id uuid, bill_id uuid, period date, kind text, bill_name text, amount numeric, due_date date, days int)
language sql stable security definer set search_path = '' as $$
  with months as (
    select (date_trunc('month', p_today) + make_interval(months => g))::date as period
    from generate_series(-3, 1) g
  ),
  occ as (
    select b.id as bill_id, b.owner_id, b.name, b.amount, m.period, pr.remind_days,
           (m.period + (least(b.due_day,
              extract(day from (m.period + interval '1 month' - interval '1 day'))::int) - 1))::date as due_date
    from public.bills b
    join public.profiles pr on pr.id = b.owner_id and pr.notify
    cross join months m
    where b.due_day is not null
      and not b.autopay
      and b.schedule in ('monthly', 'yearly')
      and (b.schedule = 'monthly' or extract(month from m.period)::int = b.due_month)
      and m.period >= b.start_month
  ),
  st as (
    select o.*, coalesce(bp.amount, o.amount) as amt, coalesce(bp.paid, false) as paid,
           (o.due_date - p_today) as days_until
    from occ o
    left join public.bill_periods bp on bp.bill_id = o.bill_id and bp.period = o.period
  ),
  k as (
    select st.*, case
      when days_until = remind_days then 'soon'
      when days_until = 0 then 'today'
      when days_until < 0 then 'late'
    end as kind
    from st where not paid
  )
  select k.owner_id, k.bill_id, k.period, k.kind, k.name, k.amt, k.due_date, k.days_until
  from k
  where k.kind is not null
    and not exists (select 1 from private.notification_log l
                    where l.bill_id = k.bill_id and l.period = k.period and l.kind = k.kind and l.sent_on = p_today)
  order by k.owner_id, k.due_date;
$$;

create or replace function public.svc_log_reminders(p_today date, p_items jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into private.notification_log(bill_id, period, kind, sent_on)
  select (i->>'bill_id')::uuid, (i->>'period')::date, i->>'kind', p_today
  from jsonb_array_elements(p_items) i
  on conflict do nothing;
$$;

-- Lock down function execution: members get app RPCs, edge functions get svc_*.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.get_bill_login(uuid) to authenticated;
grant execute on function public.set_bill_login(uuid, text, text) to authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.list_devices() to authenticated;
grant execute on function public.revoke_device(uuid) to authenticated;
grant execute on function public.svc_status(uuid, text), public.svc_setup(text, uuid, text, uuid, text, text),
  public.svc_enroll(text, text), public.svc_login(uuid, text, text), public.svc_change_pin(uuid, text, text),
  public.svc_get_secret(text), public.svc_set_secret(text, text), public.svc_pending_reminders(date),
  public.svc_log_reminders(date, jsonb) to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ───────────────────────── Secrets generated inside the database ─────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ever_after_cred_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'ever_after_cred_key',
                                'Encrypts saved bill logins');
  end if;
  if not exists (select 1 from vault.secrets where name = 'ever_after_cron') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ever_after_cron',
                                'Shared secret for the 8 AM reminder job');
  end if;
end $$;
