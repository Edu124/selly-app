-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — texting in starts an ordering session.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- THE FLOW THIS SERVES
--   1. Customer texts our number: "order"
--   2. We reply with a one-time link
--   3. They set their location once, in the browser
--   4. Nearby kitchens, menu, cart, payment -- all in the browser
--   5. Confirmation, updates and the rating link come back as SMS
--
-- WHY THIS IS BUILDABLE WHEN "ORDERING OVER SMS" IS NOT
--   Nothing dynamic ever travels in a message. Every SMS is a fixed sentence
--   with a link in it, which is exactly what a DLT template allows:
--
--       Hi {#var#}, set your delivery location here: {#var#}  -SELLYX
--
--   The menu, the kitchen list and the prices live in the browser where they can
--   change freely. A template can carry a link; it cannot carry a menu.
--
-- THE TOKEN
--   Short, because it goes in an SMS where every character is billed and 160 of
--   them is a whole segment. Ten characters of base32 is ~50 bits -- unguessable
--   in any practical sense, and short enough that the link fits alongside a
--   sentence without spilling into a second segment.
-- ═══════════════════════════════════════════════════════════════════════════════


create table if not exists public.customer_sessions (
  id         uuid primary key default gen_random_uuid(),
  token      text not null,
  mobile     text not null,

  -- Filled in once, on the location page, then reused for every later order.
  -- This is the whole reason a session exists: so nobody types their address
  -- twice.
  name       text,
  address    text,
  city       text,
  lat        numeric(9,6),
  lng        numeric(9,6),

  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);

create unique index if not exists customer_sessions_token_idx  on public.customer_sessions (token);
create unique index if not exists customer_sessions_mobile_idx on public.customer_sessions (mobile);

alter table public.customer_sessions enable row level security;
-- No policy at all: nothing reads this table directly. The three functions below
-- are the only way in, and they are the only thing that should be.

comment on table public.customer_sessions is
  'A customer who texted in. Holds the details they gave once, so the link they '
  'get next week already knows who they are.';


-- ── Ten characters, no ambiguous ones ────────────────────────────────────────
-- No 0/O or 1/I/l: this ends up in a text message somebody may read aloud down
-- a phone, and "was that a one or an ell" is a support call nobody needs.
create or replace function public.new_session_token()
returns text
language sql
volatile
as $fn$
  select string_agg(
    substr('abcdefghjkmnpqrstuvwxyz23456789',
           (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 10);
$fn$;


-- ── 1 · They texted in ───────────────────────────────────────────────────────
-- Called by the SMS webhook. Returns the token to put in the reply.
--
-- A returning customer keeps their existing session and everything in it, which
-- is what makes the second order a two-tap affair rather than a form.

create or replace function public.start_sms_session(p_mobile text)
returns table (token text, is_returning boolean, name text, has_location boolean)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_mobile text := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  v_row    public.customer_sessions%rowtype;
begin
  if length(v_mobile) <> 10 then
    raise exception 'a 10-digit mobile number is required';
  end if;

  select * into v_row from public.customer_sessions where mobile = v_mobile limit 1;

  if found then
    update public.customer_sessions
       set last_seen  = now(),
           expires_at = now() + interval '90 days'
     where id = v_row.id;
    return query select v_row.token, true, v_row.name,
                        (v_row.lat is not null or nullif(btrim(coalesce(v_row.address, '')), '') is not null);
    return;
  end if;

  insert into public.customer_sessions (token, mobile)
  values (public.new_session_token(), v_mobile)
  returning * into v_row;

  return query select v_row.token, false, null::text, false;
end;
$fn$;

revoke all on function public.start_sms_session(text) from public, anon;
-- Only the webhook, which runs with the service key. A stranger being able to
-- mint a session for somebody else's number is how you send unsolicited SMS on
-- their behalf.
grant execute on function public.start_sms_session(text) to service_role;


-- ── 2 · The link they opened ─────────────────────────────────────────────────
-- Everything the page needs to greet them and skip what it already knows.
-- Deliberately returns the mobile: it is their own number, on a page reached by
-- a token only they received.

create or replace function public.session_context(p_token text)
returns table (
  mobile text, name text, address text, city text,
  lat numeric, lng numeric, has_location boolean
)
language sql
security definer
set search_path = public
as $fn$
  update public.customer_sessions
     set last_seen = now()
   where token = lower(btrim(p_token))
     and expires_at > now()
  returning mobile, name, address, city, lat, lng,
            (lat is not null or nullif(btrim(coalesce(address, '')), '') is not null);
$fn$;

revoke all on function public.session_context(text) from public;
grant execute on function public.session_context(text) to anon, authenticated;


-- ── 3 · They filled it in ────────────────────────────────────────────────────

create or replace function public.save_session_details(
  p_token   text,
  p_name    text default null,
  p_address text default null,
  p_city    text default null,
  p_lat     numeric default null,
  p_lng     numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_hit int;
begin
  update public.customer_sessions
     set name    = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
         address = coalesce(nullif(btrim(coalesce(p_address, '')), ''), address),
         city    = coalesce(nullif(btrim(coalesce(p_city, '')), ''), city),
         -- Coordinates only overwrite when new ones are given. Somebody editing
         -- their name should not silently lose the location they set last month.
         lat     = coalesce(p_lat, lat),
         lng     = coalesce(p_lng, lng),
         last_seen = now()
   where token = lower(btrim(p_token))
     and expires_at > now();

  get diagnostics v_hit = row_count;
  return v_hit > 0;
end;
$fn$;

revoke all on function public.save_session_details(text, text, text, text, numeric, numeric) from public;
grant execute on function public.save_session_details(text, text, text, text, numeric, numeric) to anon, authenticated;


-- ── 4 · What to send them, and where ─────────────────────────────────────────
-- Read by the webhook after an order is placed, so the outbound SMS can be
-- addressed without the sender needing to know anything else.

create or replace function public.order_sms_context(p_order text)
returns table (
  mobile text, name text, kitchen text, total numeric,
  payment_mode text, rating_token uuid, public_token uuid
)
language sql
security definer
set search_path = public
as $fn$
  select o.mobile, o.name, coalesce(s.business_name, 'the kitchen'),
         (o.bill ->> 'total')::numeric, o.payment_mode, o.rating_token, o.public_token
  from public.orders o
  left join public.business_settings s on s.business_id::text = o.business_id::text
  where o.id = p_order
  limit 1;
$fn$;

revoke all on function public.order_sms_context(text) from public, anon;
grant execute on function public.order_sms_context(text) to service_role;
